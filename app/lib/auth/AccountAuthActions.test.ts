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

let mockRequestHeaders = new Headers({
    host: 'animecon.team',
    'x-forwarded-for': '203.0.113.20',
    'user-agent': 'Vitest/1.0',
});

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
import { clearAuthCache, initialisePermissionRoles } from './AuthenticationContext';
import { clearRateLimits } from './RateLimit';
import { expectAuthenticationQuery } from './AuthenticationTestHelpers';
import { hashPassword } from './Password';
import { hashSessionSecret } from './SessionStore';
import { kSessionCookieName, sealSession, unsealSession } from './Session';
import { sanitizeRelativeRedirectUrl } from './AuthHelpers';
import { sealPasswordResetRequest } from './PasswordReset';
import { sealRegistrationRequest } from './RegistrationRequest';
import { useMockConnection } from '../database/Connection';

import { kAuthType } from '../database/Types';

describe('AccountAuthActions', () => {
    const mockConnection = useMockConnection();

    beforeEach(async () => {
        mockJar.clear();
        clearAuthCache();
        clearRateLimits();
        await initialisePermissionRoles([]);
        mockRequestHeaders = new Headers({
            host: 'animecon.team',
            'x-forwarded-for': '203.0.113.20',
            'user-agent': 'Vitest/1.0',
        });
    });

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
            redirectUrl: '//evil.example.com/phish',
        });

        mockConnection.expect('update', () => 1);
        expectAuthenticationQuery(mockConnection, { userId: 91, firstName: 'Jane' });
        mockConnection.expect('insertReturningLastInsertedId', () => 401);

        const result = await registerActivateAction({ registrationRequest: token });
        expect(result).toEqual({
            success: true,
            firstName: 'Jane',
            teamName: 'Volunteering Crew',
            redirectUrl: '/registration',
        });

        const cookie = await unsealSession(mockJar.get(kSessionCookieName)!.value);
        expect(cookie).toMatchObject({ sessionId: 401, userId: 91 });

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
        mockConnection.expect('beginTransaction');
        mockConnection.expect('delete', () => 1);
        mockConnection.expect('insert', () => 1);
        mockConnection.expect('update', () => 1);
        mockConnection.expect('commit');
        mockConnection.expect('delete', () => 2);
        mockConnection.expect('insertReturningLastInsertedId', () => 501);

        const completed = await completePasswordResetAction({
            request: token,
            password: 'NewStrongPassword1',
        });
        expect(completed).toEqual({ success: true });
        const cookie = await unsealSession(mockJar.get(kSessionCookieName)!.value);
        expect(cookie).toMatchObject({ sessionId: 501, userId: 42 });
    });

    it('changes password while preserving the current persistent session and revoking others',
        async () =>
    {
        const currentHash = await hashPassword('OldPassword1');
        const secret = 'active-device-secret';
        const sealedCookie = await sealSession({ sessionId: 77, userId: 42, secret });
        mockJar.set(kSessionCookieName, { value: sealedCookie, options: {} });

        // requireAuthenticationContext({ bypassCache: true }) verifies persistent session:
        mockConnection.expect('selectOneRow', () => ({
            sessionId: 77,
            userId: 42,
            sessionTokenHash: hashSessionSecret(secret),
            impersonatorUserId: null,
            impersonatorReturnUrl: null,
        }));
        expectAuthenticationQuery(mockConnection, { userId: 42, username: 'alice@example.com' });
        mockConnection.expect('update', () => 1);  // touchUserSession

        // verifyUserCredentials checks current password:
        mockConnection.expect('selectOneColumnOneRow', () => 42);
        mockConnection.expect('selectManyRows', () => [
            { authType: kAuthType.password, authValue: currentHash },
        ]);

        // setUserPassword updates hash, bumps sessionToken, revokes OTHER sessions:
        let revokeParams: any[] = [];
        mockConnection.expect('beginTransaction');
        mockConnection.expect('delete', () => 1);
        mockConnection.expect('insert', () => 1);
        mockConnection.expect('update', () => 1);
        mockConnection.expect('commit');
        mockConnection.expect('delete', (_query: string, params: any[]) => {
            revokeParams = params;
            return 2;
        });

        const result = await changePasswordAction({
            currentPassword: 'OldPassword1',
            newPassword: 'NewPassword2',
        });

        expect(result).toEqual({ success: true });
        expect(revokeParams).toEqual([ 42, 77 ]);
    });
});
