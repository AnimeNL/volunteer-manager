// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { vi } from 'vitest';

const mockRecordLog = vi.fn();

vi.mock('next/headers', async () => {
    const { getMockHeaders, mockCookieStore } = await import('./ActionTestHelpers');
    return { cookies: async () => mockCookieStore, headers: async () => getMockHeaders() };
});

vi.mock('next/server', () => ({ after: () => {} }));

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

import { createPasskeyChallengeAction, deletePasskeyAction, listPasskeysAction,
    registerPasskeyAction } from './PasskeyActions';
import { mockCookieJar, resetAuthActionTestState, signInTestUser } from './ActionTestHelpers';
import { useMockConnection } from '../../database/Connection';

import { kLogType } from '@lib/Log';

describe('PasskeyActions', () => {
    const mockConnection = useMockConnection();

    beforeEach(async () => {
        mockRecordLog.mockClear();
        await resetAuthActionTestState('203.0.113.30');
    });

    it('lists registered passkeys formatted for the current RP ID', async () => {
        await signInTestUser(mockConnection, { userId: 42 });
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
        await signInTestUser(mockConnection, { userId: 42 });
        mockConnection.expect('selectManyRows', () => []);

        const result = await createPasskeyChallengeAction();
        expect(result.success).toBe(true);
        expect(result.options?.optionsJSON.rp.id).toBe('animecon.team');
        expect(mockCookieJar.get('passkey_challenge')?.value).toBeTruthy();
        expect(mockCookieJar.get('passkey_challenge')?.options.httpOnly).toBe(true);
    });

    it('rejects passkey registration when no challenge cookie is present', async () => {
        await signInTestUser(mockConnection, { userId: 42 });

        const result = await registerPasskeyAction({
            name: 'YubiKey',
            registration: { id: 'cred-1' } as any,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('passkey registration flow');
    });

    it('deletes passkeys and logs AccountPasskeyDelete', async () => {
        await signInTestUser(mockConnection, { userId: 42 });
        mockConnection.expect('delete', () => 1);

        const result = await deletePasskeyAction({ id: 9 });
        expect(result).toEqual({ success: true });
        expect(mockRecordLog).toHaveBeenCalledWith(expect.objectContaining({
            type: kLogType.AccountPasskeyDelete,
        }));
    });
});
