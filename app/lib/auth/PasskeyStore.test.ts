// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { deleteUserPasskey, retrieveUserPasskeys, storeUserPasskey, updatePasskeyCounter }
    from './PasskeyStore';
import { useMockConnection } from '../database/Connection';

describe('PasskeyStore', () => {
    const mockConnection = useMockConnection();

    it('retrieves passkeys scoped to userId and rpId ordered by recent usage', async () => {
        const credentialId = new Uint8Array([ 1, 2, 3, 4 ]);
        const credentialPublicKey = new Uint8Array([ 5, 6, 7, 8 ]);

        mockConnection.expect('selectManyRows', (query, params) => {
            expect(query).toContain('users_passkeys');
            expect(query).toContain('user_id');
            expect(query).toContain('credential_rpid');
            expect(query).toContain('order by');
            expect(params).toEqual([ 42, 'animecon.team' ]);

            return [
                {
                    passkeyId: 7,
                    name: 'Work Laptop',
                    credentialId,
                    credentialPublicKey,
                    counter: 3n,
                    created: '2026-01-10 10:00:00',
                    lastUsed: '2026-06-01 12:00:00',
                },
            ];
        });

        const passkeys = await retrieveUserPasskeys(42, 'animecon.team');
        expect(passkeys).toHaveLength(1);
        expect(passkeys[0]).toMatchObject({
            passkeyId: 7,
            name: 'Work Laptop',
            credentialId,
            credentialPublicKey,
            counter: 3n,
        });
        expect(passkeys[0].created.equals(Temporal.ZonedDateTime.from('2026-01-10T10:00:00[UTC]')))
            .toBe(true);
        expect(passkeys[0].lastUsed?.equals(
            Temporal.ZonedDateTime.from('2026-06-01T12:00:00[UTC]'))).toBe(true);

        mockConnection.expect('selectManyRows', (_query, params) => {
            expect(params).toEqual([ 42, 'other.example' ]);
            return [];
        });

        await expect(retrieveUserPasskeys(42, 'other.example')).resolves.toEqual([]);
    });

    it('stores verified passkey registrations with base64url decoding and optional fields',
        async () =>
    {
        const rawCredentialId = Buffer.from('test-credential-id');
        const publicKey = new Uint8Array([ 10, 20, 30, 40 ]);

        let capturedParams: any[] = [];
        mockConnection.expect('insert', (query, params) => {
            expect(query).toContain('insert into users_passkeys');
            capturedParams = params;
            return 1;
        });

        await storeUserPasskey(42, 'animecon.team', 'YubiKey 5', {
            fmt: 'none',
            origin: 'https://animecon.team',
            credentialDeviceType: 'multiDevice',
            credentialBackedUp: true,
            credential: {
                id: rawCredentialId.toString('base64url'),
                publicKey,
                counter: 5,
                transports: [ 'internal', 'hybrid' ],
            },
        } as any);

        expect(capturedParams).toContain(42);
        expect(capturedParams).toContain('animecon.team');
        expect(capturedParams).toContain('YubiKey 5');
        expect(capturedParams).toContain('https://animecon.team');
        expect(capturedParams).toContain('multiDevice');
        expect(capturedParams).toContain(1);
        expect(capturedParams).toContain('internal, hybrid');
        expect(capturedParams.some(p => Buffer.isBuffer(p) && p.equals(rawCredentialId)))
            .toBe(true);
        expect(capturedParams.some(p => Buffer.isBuffer(p) && p.equals(Buffer.from(publicKey))))
            .toBe(true);

        // Empty name, unbacked-up credential, and omitted transports store null/0 defaults:
        let minimalParams: any[] = [];
        mockConnection.expect('insert', (_query, params) => {
            minimalParams = params;
            return 1;
        });

        await storeUserPasskey(42, 'animecon.team', '', {
            fmt: 'none',
            origin: 'https://animecon.team',
            credentialDeviceType: 'singleDevice',
            credentialBackedUp: false,
            credential: {
                id: rawCredentialId.toString('base64url'),
                publicKey,
                counter: 0,
            },
        } as any);

        expect(minimalParams).toContain(0);
        expect(minimalParams.filter(p => p === null).length).toBeGreaterThanOrEqual(2);
    });

    it('enforces a monotonic counter guard when updating passkey usage', async () => {
        mockConnection.expect('update', (query, params) => {
            expect(query).toContain('update users_passkeys');
            expect(query).toContain('credential_last_used');
            expect(query).toMatch(/counter\s*<=\s*\?/);
            expect(params).toEqual([ 12n, 42, 7, 12n ]);
            return 1;
        });

        await updatePasskeyCounter(42, 7, 12n);
    });

    it('deletes only passkeys owned by the given user and reports affected rows', async () => {
        mockConnection.expect('delete', (query, params) => {
            expect(query).toContain('delete from users_passkeys');
            expect(query).toContain('user_id');
            expect(query).toContain('user_passkey_id');
            expect(params).toEqual([ 42, 7 ]);
            return 1;
        });

        await expect(deleteUserPasskey(42, 7)).resolves.toBe(true);

        mockConnection.expect('delete', (_query, params) => {
            expect(params).toEqual([ 99, 7 ]);
            return 0;
        });

        await expect(deleteUserPasskey(99, 7)).resolves.toBe(false);
    });
});
