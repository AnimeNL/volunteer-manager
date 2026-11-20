// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { hashPassword } from './Password';
import { useMockConnection } from '../database/Connection';
import { verifyUserCredentials } from './Authentication';

import { kAuthType } from '../database/Types';

describe('Authentication.verifyUserCredentials', () => {
    const mockConnection = useMockConnection();

    afterEach(() => {
        delete process.env.APP_PASSWORD_SALT;
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

    it('authenticates both legacy plaintext and Argon2id-hashed access codes', async () => {
        // Legacy plaintext 4-digit code:
        mockConnection.expect('selectOneColumnOneRow', () => 12);
        mockConnection.expect('selectManyRows', () => [
            { authType: kAuthType.code, authValue: '4821' },
        ]);

        await expect(verifyUserCredentials('user@example.com', '4821'))
            .resolves.toEqual({ authenticated: true, authType: 'code', userId: 12 });

        // Argon2id-hashed access code:
        const hashedCode = await hashPassword('ABCD-2345');
        mockConnection.expect('selectOneColumnOneRow', () => 12);
        mockConnection.expect('selectManyRows', () => [
            { authType: kAuthType.code, authValue: hashedCode },
        ]);

        await expect(verifyUserCredentials('user@example.com', 'ABCD-2345'))
            .resolves.toEqual({ authenticated: true, authType: 'code', userId: 12 });
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
