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
    'x-forwarded-for': '203.0.113.40',
    'user-agent': 'Vitest/1.0',
});

const mockStoreBlobData = vi.fn(async () => 999);

vi.mock('next/headers', () => ({
    cookies: async () => mockCookieStore,
    headers: async () => mockRequestHeaders,
}));

vi.mock('next/server', () => ({
    after: () => {},
}));

vi.mock('@lib/database/BlobStore', () => ({
    getBlobUrl: (hash: string) => `/blob/${hash}.png`,
    storeBlobData: (...args: any[]) => (mockStoreBlobData as any)(...args),
}));

import { clearAuthCache, initialisePermissionRoles } from '../AuthenticationContext';
import { expectAuthenticationQuery } from '../AuthenticationTestHelpers';
import { getOwnAccountAction, updateAvatarAction, updateOwnAccountAction } from './ProfileActions';
import { hashSessionSecret } from '../SessionStore';
import { kSessionCookieName, sealSession } from '../Session';
import { useMockConnection } from '../../database/Connection';

describe('ProfileActions', () => {
    const mockConnection = useMockConnection();

    async function signInAs(userId: number, grants?: string) {
        const secret = 'profile-test-secret';
        const cookie = await sealSession({ sessionId: 66, userId, secret });
        mockJar.set(kSessionCookieName, { value: cookie, options: {} });

        mockConnection.expect('selectOneRow', () => ({
            sessionId: 66,
            userId,
            sessionTokenHash: hashSessionSecret(secret),
            impersonatorUserId: null,
            impersonatorReturnUrl: null,
        }));
        expectAuthenticationQuery(mockConnection, {
            userId,
            username: 'alice@example.com',
            accessControl: grants ? { grants } : undefined,
        });
        mockConnection.expect('update', () => 1);
    }

    beforeEach(async () => {
        mockJar.clear();
        mockStoreBlobData.mockClear();
        clearAuthCache();
        await initialisePermissionRoles([]);
    });

    it('retrieves and updates the signed-in user profile', async () => {
        await signInAs(42);
        mockConnection.expect('selectOneRow', () => ({
            firstName: 'Alice',
            lastName: 'Example',
            username: 'alice@example.com',
            language: 'English',
            gender: 'Female',
            birthdate: '1995-04-10',
            phoneNumber: '+31612345678',
            discordHandle: 'alice#1234',
        }));

        const fetched = await getOwnAccountAction();
        expect(fetched).toEqual({
            success: true,
            account: {
                firstName: 'Alice',
                lastName: 'Example',
                username: 'alice@example.com',
                language: 'English',
                gender: 'Female',
                birthdate: '1995-04-10',
                phoneNumber: '+31612345678',
                discordHandle: 'alice#1234',
            },
        });

        // Invalid phone number rejected before DB query:
        const invalid = await updateOwnAccountAction({
            firstName: 'Alice',
            lastName: 'Example',
            gender: 'Female',
            birthdate: '1995-04-10',
            phoneNumber: '123',
        });
        expect(invalid.success).toBe(false);

        // Valid update writes to database and invalidates auth cache:
        mockConnection.expect('selectOneRow', () => ({
            firstName: 'Alice',
            lastName: 'Example',
            username: 'alice@example.com',
            language: 'English',
            gender: 'Female',
            birthdate: '1995-04-10',
            phoneNumber: '+31612345678',
            discordHandle: 'alice#1234',
            discordHandleUpdated: null,
        }));
        mockConnection.expect('update', () => 1);

        const updated = await updateOwnAccountAction({
            firstName: 'Alicia',
            lastName: 'Example',
            gender: 'Female',
            birthdate: '1995-04-10',
            phoneNumber: '+31612345678',
            discordHandle: 'alice#1234',
        });
        expect(updated).toEqual({ success: true });
    });

    it('validates PNG uploads and enforces permissions for overrideUserId in updateAvatarAction',
        async () =>
    {
        await signInAs(42);

        // Rejects non-PNG payload:
        const invalidForm = new FormData();
        invalidForm.set('avatar', new Blob([ 'not a png' ], { type: 'text/plain' }));
        const rejected = await updateAvatarAction(invalidForm);
        expect(rejected.success).toBe(false);
        expect(rejected.error).toContain('PNG');

        // Rejects overrideUserId without `organisation.avatars` permission (throws 403):
        const pngBytes = new Uint8Array([ 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00 ]);
        const overrideForm = new FormData();
        overrideForm.set('avatar', new Blob([ pngBytes ], { type: 'image/png' }));
        overrideForm.set('overrideUserId', '99');

        await expect(updateAvatarAction(overrideForm)).rejects.toThrow();

        // Accepts valid PNG for self:
        const validForm = new FormData();
        validForm.set('avatar', new Blob([ pngBytes ], { type: 'image/png' }));
        mockConnection.expect('update', () => 1);

        const uploaded = await updateAvatarAction(validForm);
        expect(uploaded).toEqual({ success: true });
        expect(mockStoreBlobData).toHaveBeenCalledWith(expect.objectContaining({
            mimeType: 'image/png',
            userId: 42,
        }));
    });
});
