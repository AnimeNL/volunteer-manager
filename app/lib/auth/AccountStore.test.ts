// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { vi } from 'vitest';

import { createUserAccessCode, verifyUserCredentials } from './AccountStore';
import { hashPassword } from './Password';
import { useMockConnection } from '../database/Connection';

import { kAuthType } from '../database/Types';

describe('AccountStore.verifyUserCredentials', () => {
    const mockConnection = useMockConnection();

    afterEach(() => {
        delete process.env.APP_PASSWORD_SALT;
        vi.useRealTimers();
    });

    it('authenticates Argon2id passwords without triggering an upgrade write', async () => {
        const storedHash = await hashPassword('CorrectHorse1');

        mockConnection.expect('selectOneColumnOneRow', () => 42);
        mockConnection.expect('selectManyRows', () => [
            { authType: kAuthType.password, authValue: storedHash },
        ]);

        const result = await verifyUserCredentials('user@example.com', 'CorrectHorse1');
        expect(result).toEqual({ authenticated: true, authType: 'password', userId: 42 });
    });

    it('verifies legacy v0 passwords and silently upgrades them to Argon2id', async () => {
        process.env.APP_PASSWORD_SALT = 'FirstSalt';
        const legacyHash = 'ca21cf41529f899ba3e54d17691608525e28b78e1083b017764060d51532e30d';

        let upgradedAuthValue: string | undefined;

        mockConnection.expect('selectOneColumnOneRow', () => 42);
        mockConnection.expect('selectManyRows', () => [
            { authType: kAuthType.password, authValue: legacyHash },
        ]);
        mockConnection.expect('update', (_query: string, params: any[]) => {
            upgradedAuthValue = params[0];
            return 1;
        });

        const result = await verifyUserCredentials('user@example.com', 'changeme1234');
        expect(result).toEqual({ authenticated: true, authType: 'password', userId: 42 });
        expect(upgradedAuthValue).toMatch(/^\$argon2id\$v=19\$/);
    });

    it('authenticates, consumes, and expires access codes (and clears unused codes on login)',
        async () =>
    {
        // Legacy plaintext 4-digit code is consumed atomically on use:
        mockConnection.expect('selectOneColumnOneRow', () => 12);
        mockConnection.expect('selectManyRows', () => [
            { authType: kAuthType.code, authValue: '4821' },
        ]);
        mockConnection.expect('delete', () => 1);

        await expect(verifyUserCredentials('user@example.com', '4821'))
            .resolves.toEqual({ authenticated: true, authType: 'code', userId: 12 });

        // Newly issued 24-hour code succeeds before expiry and fails once expired:
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));

        let storedCodeHash = '';
        mockConnection.expect('beginTransaction');
        mockConnection.expect('delete', () => 0);
        mockConnection.expect('insert', (_query, params) => {
            storedCodeHash = params[2];
            return 1;
        });
        mockConnection.expect('commit');

        const code = await createUserAccessCode(12);
        expect(code).toMatch(/^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
        expect(storedCodeHash).toMatch(/^\$exp=\d+\$argon2id\$v=19\$/);

        mockConnection.expect('selectOneColumnOneRow', () => 12);
        mockConnection.expect('selectManyRows', () => [
            { authType: kAuthType.code, authValue: storedCodeHash },
        ]);
        mockConnection.expect('delete', () => 1);
        await expect(verifyUserCredentials('user@example.com', code!))
            .resolves.toEqual({ authenticated: true, authType: 'code', userId: 12 });

        vi.advanceTimersByTime(24 * 3600_000 + 1_000);
        mockConnection.expect('selectOneColumnOneRow', () => 12);
        mockConnection.expect('selectManyRows', () => [
            { authType: kAuthType.code, authValue: storedCodeHash },
        ]);
        await expect(verifyUserCredentials('user@example.com', code!))
            .resolves.toEqual({ authenticated: false });

        // Password login clears any lingering unused access code:
        const passwordHash = await hashPassword('CorrectHorse1');
        mockConnection.expect('selectOneColumnOneRow', () => 12);
        mockConnection.expect('selectManyRows', () => [
            { authType: kAuthType.password, authValue: passwordHash },
            { authType: kAuthType.code, authValue: storedCodeHash },
        ]);
        mockConnection.expect('delete', () => 1);
        await expect(verifyUserCredentials('user@example.com', 'CorrectHorse1'))
            .resolves.toEqual({ authenticated: true, authType: 'password', userId: 12 });
    });

    it('rejects unknown users and invalid passwords', async () => {
        mockConnection.expect('selectOneColumnOneRow', () => undefined);
        await expect(verifyUserCredentials('missing@example.com', 'CorrectHorse1'))
            .resolves.toEqual({ authenticated: false });

        const storedHash = await hashPassword('CorrectHorse1');
        mockConnection.expect('selectOneColumnOneRow', () => 42);
        mockConnection.expect('selectManyRows', () => [
            { authType: kAuthType.password, authValue: storedHash },
        ]);

        await expect(verifyUserCredentials('user@example.com', 'WrongPassword1'))
            .resolves.toEqual({ authenticated: false });
    });
});
