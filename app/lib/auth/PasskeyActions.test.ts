// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { vi } from 'vitest';

const mockJar = new Map<string, { value: string; options: any }>();
const mockCookieStore = {
    get: (name: string) => {
        const entry = mockJar.get(name);
        return entry ? { name, value: entry.value } : undefined;
    },
    set: (name: string, value: string, options: any) => {
        mockJar.set(name, { value, options });
    },
};

const mockRequestHeaders = new Headers({
    host: 'animecon.team',
    'x-forwarded-for': '203.0.113.30',
    'user-agent': 'Vitest/1.0',
});

const mockRecordLog = vi.fn();

vi.mock('next/headers', () => ({
    cookies: async () => mockCookieStore,
    headers: async () => mockRequestHeaders,
}));

vi.mock('next/server', () => ({
    after: () => {},
}));

vi.mock('@lib/Environment', () => ({
    determineEnvironment: async () => ({
        id: 1,
        domain: 'animecon.team',
        title: 'Volunteering Crew',
    }),
}));

vi.mock('@lib/Log', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@lib/Log')>();
    return { ...actual, RecordLog: (...args: any[]) => mockRecordLog(...args) };
});

import { clearAuthCache, initialisePermissionRoles } from './AuthenticationContext';
import { createPasskeyChallengeAction, deletePasskeyAction, listPasskeysAction,
    registerPasskeyAction } from './PasskeyActions';
import { expectAuthenticationQuery } from './AuthenticationTestHelpers';
import { hashSessionSecret } from './SessionStore';
import { kLogType } from '@lib/Log';
import { kSessionCookieName, sealSession } from './Session';
import { useMockConnection } from '../database/Connection';

describe('PasskeyActions', () => {
    const mockConnection = useMockConnection();

    async function signInAs(userId: number) {
        const secret = 'passkey-test-secret';
        const cookie = await sealSession({ sessionId: 55, userId, secret });
        mockJar.set(kSessionCookieName, { value: cookie, options: {} });

        mockConnection.expect('selectOneRow', () => ({
            sessionId: 55,
            userId,
            sessionTokenHash: hashSessionSecret(secret),
            impersonatorUserId: null,
            impersonatorReturnUrl: null,
        }));
        expectAuthenticationQuery(mockConnection, { userId, username: 'alice@example.com' });
        mockConnection.expect('update', () => 1);
    }

    beforeEach(async () => {
        mockJar.clear();
        mockRecordLog.mockClear();
        clearAuthCache();
        await initialisePermissionRoles([]);
    });

    it('lists registered passkeys formatted for the current RP ID', async () => {
        await signInAs(42);
        mockConnection.expect('selectManyRows', () => [
            {
                passkeyId: 9,
                name: 'MacBook Touch ID',
                credentialId: Buffer.from('cred-1'),
                credentialPublicKey: Buffer.from('pub-1'),
                counter: 3n,
                created: '2026-03-15 10:00:00',
                lastUsed: null,
            },
        ]);

        const result = await listPasskeysAction();
        expect(result).toEqual({
            success: true,
            passkeys: [
                {
                    id: 9,
                    label: 'MacBook Touch ID',
                    description: 'Created on 15/03/2026, never used',
                },
            ],
        });
    });

    it('creates a passkey registration challenge stored in a sealed HttpOnly cookie', async () => {
        await signInAs(42);
        mockConnection.expect('selectManyRows', () => []);

        const result = await createPasskeyChallengeAction();
        expect(result.success).toBe(true);
        expect(result.options?.optionsJSON.rp.id).toBe('animecon.team');
        expect(mockJar.get('passkey_challenge')?.value).toBeTruthy();
        expect(mockJar.get('passkey_challenge')?.options.httpOnly).toBe(true);
    });

    it('rejects passkey registration when no challenge cookie is present', async () => {
        await signInAs(42);

        const result = await registerPasskeyAction({
            name: 'YubiKey',
            registration: { id: 'cred-1' } as any,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('passkey registration flow');
    });

    it('deletes passkeys and logs AccountPasskeyDelete', async () => {
        await signInAs(42);
        mockConnection.expect('delete', () => 1);

        const result = await deletePasskeyAction({ id: 9 });
        expect(result).toEqual({ success: true });
        expect(mockRecordLog).toHaveBeenCalledWith(expect.objectContaining({
            type: kLogType.AccountPasskeyDelete,
        }));
    });
});
