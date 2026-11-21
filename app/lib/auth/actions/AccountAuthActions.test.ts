// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { vi } from 'vitest';

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

vi.mock('@lib/Content', () => ({
    getStaticContent: async () => ({
        title: 'Reset your password',
        markdown: 'Click the link to continue.',
    }),
}));

vi.mock('@lib/scheduler/tasks/SendEmailTask', () => ({
    SendEmailTask: { Schedule: vi.fn(async () => {}) },
}));

vi.mock('@lib/subscriptions', () => ({
    Publish: vi.fn(async () => {}),
    kSubscriptionType: { Registration: 'registration' },
}));

import { changePasswordAction, completePasswordResetAction, registerAction,
    registerActivateAction, verifyPasswordResetAction } from './AccountAuthActions';
import { expectAuthenticationQuery } from '../AuthenticationTestHelpers';
import { expectSetUserPassword, mockCookieJar, resetAuthActionTestState, signInTestUser }
    from './ActionTestHelpers';
import { hashPassword } from '../Password';
import { kSessionCookieName, unsealSession } from '../Session';
import { sanitizeRelativeRedirectUrl } from '../SessionStore';
import { sealPasswordResetRequest, sealRegistrationRequest } from '../Tokens';
import { useMockConnection } from '../../database/Connection';

import { kAuthType } from '../../database/Types';

describe('AccountAuthActions', () => {
    const mockConnection = useMockConnection();

    beforeEach(() => resetAuthActionTestState('203.0.113.20'));

    it('sanitizes relative redirect URLs to prevent open redirects', () => {
        expect(sanitizeRelativeRedirectUrl('/registration/2026')).toBe('/registration/2026');
        expect(sanitizeRelativeRedirectUrl('//evil.example.com')).toBeUndefined();
        expect(sanitizeRelativeRedirectUrl('https://evil.example.com')).toBeUndefined();
        expect(sanitizeRelativeRedirectUrl('javascript:alert(1)')).toBeUndefined();
        expect(sanitizeRelativeRedirectUrl(undefined)).toBeUndefined();
    });

    it('validates password strength and GDPR consent during registration', async () => {
        const baseInput = {
            username: 'new@example.com',
            password: 'StrongPassword1',
            firstName: 'New',
            lastName: 'Volunteer',
            gender: 'Other',
            birthdate: '1998-05-12',
            phoneNumber: '+31612345678',
            gdpr: true,
        };

        const missingGdpr = await registerAction({ ...baseInput, gdpr: false });
        expect(missingGdpr.success).toBe(false);
        expect(missingGdpr.error).toContain('GDPR');

        const weakPassword = await registerAction({ ...baseInput, password: 'weak' });
        expect(weakPassword.success).toBe(false);
        expect(weakPassword.error).toContain('8 characters');

        // Valid registration stores an Argon2id password hash:
        let storedHash: string | undefined;
        mockConnection.expect('selectOneRow', () => undefined);
        mockConnection.expect('beginTransaction');
        mockConnection.expect('insertReturningLastInsertedId', () => 91);
        mockConnection.expect('insert', (_query: string, params: any[]) => {
            storedHash = params[2];
            return 1;
        });
        mockConnection.expect('commit');

        const created = await registerAction({
            ...baseInput,
            redirectUrl: 'https://evil.example.com',
        });
        expect(created).toEqual({ success: true });
        expect(storedHash).toMatch(/^\$argon2id\$v=19\$/);
    });

    it('activates accounts atomically and sanitizes untrusted redirect URLs', async () => {
        const token = await sealRegistrationRequest({
            id: 91,
            token: 1,
            redirectUrl: '//evil.example.com/phish',
        });

        let updateQuery = '';
        let updateParams: any[] = [];
        mockConnection.expect('update', (query, params) => {
            updateQuery = query;
            updateParams = params;
            return 1;
        });
        expectAuthenticationQuery(mockConnection, { userId: 91, firstName: 'Jane' });
        mockConnection.expect('insertReturningLastInsertedId', () => 401);

        const result = await registerActivateAction({ registrationRequest: token });
        expect(result).toEqual({
            success: true,
            firstName: 'Jane',
            teamName: 'Volunteering Crew',
            redirectUrl: '/registration',
        });
        expect(updateQuery).toContain('session_token');
        expect(updateParams).toContain(1);

        const cookie = await unsealSession(mockCookieJar.get(kSessionCookieName)!.value);
        expect(cookie).toMatchObject({ sessionId: 401, userId: 91 });

        // Replaying the activation token after deactivation (`session_token` rotated) fails:
        mockConnection.expect('update', () => 0);
        await expect(registerActivateAction({ registrationRequest: token }))
            .resolves.toEqual({ success: false });

        // Tampered token fails cleanly without throwing:
        await expect(registerActivateAction({ registrationRequest: 'v1.bad.token' }))
            .resolves.toEqual({ success: false });
    });

    it('verifies and completes password resets with Argon2id and full session revocation',
        async () =>
    {
        const token = await sealPasswordResetRequest({ id: 42, token: 5 });

        // Tampered token returns { success: false }:
        await expect(verifyPasswordResetAction({ request: 'v1.invalid.token' }))
            .resolves.toEqual({ success: false });

        // Valid token returns firstName:
        expectAuthenticationQuery(mockConnection, { userId: 42, firstName: 'Alice' });
        await expect(verifyPasswordResetAction({ request: token }))
            .resolves.toEqual({ success: true, firstName: 'Alice' });

        // Completing reset updates password to Argon2id, revokes sessions, and signs in:
        expectAuthenticationQuery(mockConnection, { userId: 42, firstName: 'Alice' });
        expectSetUserPassword(mockConnection, { revokedCount: 2 });
        mockConnection.expect('insertReturningLastInsertedId', () => 501);

        const completed = await completePasswordResetAction({
            request: token,
            password: 'NewStrongPassword1',
        });
        expect(completed).toEqual({ success: true });
        const cookie = await unsealSession(mockCookieJar.get(kSessionCookieName)!.value);
        expect(cookie).toMatchObject({ sessionId: 501, userId: 42 });

        // Concurrent replay where `session_token` was already rotated aborts atomically:
        mockCookieJar.clear();

        expectAuthenticationQuery(mockConnection, { userId: 42, firstName: 'Alice' });

        mockConnection.expect('beginTransaction');
        mockConnection.expect('update', (_query, params) => {
            expect(params).toEqual([ 1, 42, 5 ]);
            return 0;
        });

        mockConnection.expect('commit');

        const raced = await completePasswordResetAction({
            request: token,
            password: 'AnotherStrongPassword1',
        });

        expect(raced).toEqual({
            success: false,
            error: 'This password reset link is no longer valid.',
        });

        expect(mockCookieJar.has(kSessionCookieName)).toBe(false);
    });

    it('changes password while preserving the current persistent session and revoking others',
        async () =>
    {
        const currentHash = await hashPassword('OldPassword1');
        await signInTestUser(mockConnection, { userId: 42, sessionId: 77 });

        // verifyUserCredentials checks current password:
        mockConnection.expect('selectOneColumnOneRow', () => 42);
        mockConnection.expect('selectManyRows', () => [
            { authType: kAuthType.password, authValue: currentHash },
        ]);

        // setUserPassword updates hash, bumps sessionToken, revokes OTHER sessions:
        let revokeParams: any[] = [];
        expectSetUserPassword(mockConnection, {
            revokedCount: 2,
            onRevokeParams: params => { revokeParams = params; },
        });

        const result = await changePasswordAction({
            currentPassword: 'OldPassword1',
            newPassword: 'NewPassword2',
        });

        expect(result).toEqual({ success: true });
        expect(revokeParams).toEqual([ 42, 42, 77 ]);
    });
});
