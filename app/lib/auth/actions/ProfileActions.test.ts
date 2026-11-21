// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { vi } from 'vitest';

const mockStoreBlobData = vi.fn(async () => 999);

vi.mock('next/headers', async () => {
    const { getMockHeaders, mockCookieStore } = await import('./ActionTestHelpers');
    return { cookies: async () => mockCookieStore, headers: async () => getMockHeaders() };
});

vi.mock('next/server', () => ({ after: () => {} }));

vi.mock('@lib/database/BlobStore', () => ({
    getBlobUrl: (hash: string) => `/blob/${hash}.png`,
    storeBlobData: (...args: any[]) => (mockStoreBlobData as any)(...args),
}));

import { checkRateLimit } from '../RateLimit';
import { getOwnAccountAction, updateAvatarAction, updateOwnAccountAction } from './ProfileActions';
import { resetAuthActionTestState, signInTestUser } from './ActionTestHelpers';
import { useMockConnection } from '../../database/Connection';

import { kAuthRateLimits } from '../RateLimit';

describe('ProfileActions', () => {
    const mockConnection = useMockConnection();

    beforeEach(async () => {
        mockStoreBlobData.mockClear();
        await resetAuthActionTestState('203.0.113.40');
    });

    it('retrieves and updates the signed-in user profile', async () => {
        await signInTestUser(mockConnection, { userId: 42, sessionId: 66 });
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

        // Invalid phone number, impossible calendar date, and oversized fields rejected before DB:
        const invalid = await updateOwnAccountAction({
            firstName: 'Alice',
            lastName: 'Example',
            gender: 'Female',
            birthdate: '1995-04-10',
            phoneNumber: '123',
        });
        expect(invalid.success).toBe(false);

        const whitespacePhone = await updateOwnAccountAction({
            firstName: 'Alice',
            lastName: 'Example',
            gender: 'Female',
            birthdate: '1995-04-10',
            phoneNumber: '        ',
        });
        expect(whitespacePhone.success).toBe(false);

        const impossibleDate = await updateOwnAccountAction({
            firstName: 'Alice',
            lastName: 'Example',
            gender: 'Female',
            birthdate: '2026-02-31',
            phoneNumber: '+31612345678',
        });
        expect(impossibleDate.success).toBe(false);

        const malformedDate = await updateOwnAccountAction({
            firstName: 'Alice',
            lastName: 'Example',
            gender: 'Female',
            birthdate: '|999-01-01',
            phoneNumber: '+31612345678',
        });
        expect(malformedDate.success).toBe(false);

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
        await signInTestUser(mockConnection, { userId: 42, sessionId: 66 });

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

        await signInTestUser(mockConnection, { userId: 42, sessionId: 66 });
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

        // Authorized override rejects missing/anonymized target before storing blob data:
        mockStoreBlobData.mockClear();
        await resetAuthActionTestState('203.0.113.41');
        await signInTestUser(
            mockConnection, { userId: 7, sessionId: 88, grants: 'organisation.avatars' });
        await signInTestUser(
            mockConnection, { userId: 7, sessionId: 88, grants: 'organisation.avatars' });
        mockConnection.expect('selectOneColumnOneRow', () => undefined);

        const missingTarget = await updateAvatarAction(overrideForm);
        expect(missingTarget.success).toBe(false);
        expect(mockStoreBlobData).not.toHaveBeenCalled();

        // Rate limit is enforced before reading the uploaded blob into memory:
        for (let i = 0; i < kAuthRateLimits.avatarUploadByUser.limit; ++i)
            checkRateLimit('avatar-upload-user', '7', kAuthRateLimits.avatarUploadByUser);

        const limitedForm = new FormData();
        limitedForm.set('avatar', new Blob([ pngBytes ], { type: 'image/png' }));
        const arrayBufferSpy = vi.spyOn(Blob.prototype, 'arrayBuffer');
        try {
            const limited = await updateAvatarAction(limitedForm);
            expect(limited).toEqual({
                success: false,
                error: expect.stringContaining('Too many'),
            });
            expect(arrayBufferSpy).not.toHaveBeenCalled();
            expect(mockStoreBlobData).not.toHaveBeenCalled();
        } finally {
            arrayBufferSpy.mockRestore();
        }
    });
});
