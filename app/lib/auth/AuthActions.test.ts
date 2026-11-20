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
    'x-forwarded-for': '203.0.113.10',
    'user-agent': 'Vitest/1.0',
});

vi.mock('next/headers', () => ({
    cookies: async () => mockCookieStore,
    headers: async () => mockRequestHeaders,
}));

vi.mock('next/server', () => ({
    after: () => {},
}));

import { clearRateLimits } from './RateLimit';
import { confirmIdentityAction, signInPasskeyAction, signInPasswordAction,
    signInPasswordUpdateAction, signOutAction } from './AuthActions';
import { expectAuthenticationQuery } from './AuthenticationTestHelpers';
import { hashPassword } from './Password';
import { hashSessionSecret } from './SessionStore';
import { kSessionCookieName, unsealSession } from './Session';
import { sealPasswordResetRequest, unsealPasswordResetRequest } from './PasswordReset';
import { useMockConnection } from '../database/Connection';

import { kAuthType } from '../database/Types';

describe('AuthActions', () => {
    const mockConnection = useMockConnection();

    beforeEach(() => {
        mockJar.clear();
        clearRateLimits();
        mockRequestHeaders = new Headers({
            host: 'animecon.team',
            'x-forwarded-for': '203.0.113.10',
            'user-agent': 'Vitest/1.0',
        });
    });

    it('confirms identity and issues a sealed passkey challenge cookie when passkeys exist',
        async () =>
    {
        // Unknown user:
        mockConnection.expect('selectOneRow', () => undefined);
        await expect(confirmIdentityAction({ username: 'unknown@example.com' }))
            .resolves.toEqual({ success: false });

        // Unactivated user (no passkey lookup):
        mockConnection.expect('selectOneRow', () => ({ id: 7, activated: false }));
        await expect(confirmIdentityAction({ username: 'pending@example.com' }))
            .resolves.toEqual({
                success: true,
                activated: false,
                authenticationOptions: undefined,
            });

        // Activated user with a registered passkey:
        mockConnection.expect('selectOneRow', () => ({ id: 42, activated: true }));
        mockConnection.expect('selectManyRows', () => [
            {
                passkeyId: 5,
                name: 'Laptop',
                credentialId: Buffer.from('cred-id-bytes'),
                credentialPublicKey: Buffer.from('pub-key-bytes'),
                counter: 1n,
                created: '2026-06-01 12:00:00',
                lastUsed: null,
            },
        ]);

        const result = await confirmIdentityAction({ username: 'alice@example.com' });
        expect(result.success).toBe(true);
        expect(result.activated).toBe(true);
        expect(result.authenticationOptions?.optionsJSON.rpId).toBe('animecon.team');
        expect(mockJar.get('passkey_challenge')?.value).toBeTruthy();
        expect(mockJar.get('passkey_challenge')?.options.httpOnly).toBe(true);
    });

    it('authenticates plaintext passwords and one-time access codes with rate limiting',
        async () =>
    {
        const passwordHash = await hashPassword('CorrectHorse1');

        // Password sign-in issues a persistent session cookie:
        mockConnection.expect('selectOneColumnOneRow', () => 42);
        mockConnection.expect('selectManyRows', () => [
            { authType: kAuthType.password, authValue: passwordHash },
        ]);
        mockConnection.expect('insertReturningLastInsertedId', () => 105);

        const passwordResult = await signInPasswordAction({
            username: 'alice@example.com',
            password: 'CorrectHorse1',
        });
        expect(passwordResult).toEqual({ success: true });

        const cookie = await unsealSession(mockJar.get(kSessionCookieName)!.value);
        expect(cookie).toMatchObject({ sessionId: 105, userId: 42 });

        // Access code sign-in returns a sealed password update token without signing in yet:
        const codeHash = await hashPassword('ABCD-2345');
        mockConnection.expect('selectOneColumnOneRow', () => 42);
        mockConnection.expect('selectManyRows', () => [
            { authType: kAuthType.code, authValue: codeHash },
        ]);
        mockConnection.expect('selectOneColumnOneRow', () => 7);

        const codeResult = await signInPasswordAction({
            username: 'alice@example.com',
            password: 'ABCD-2345',
        });
        expect(codeResult.success).toBe(true);
        expect(codeResult.requiredPasswordUpdateToken).toBeTruthy();

        const unsealed = await unsealPasswordResetRequest(codeResult.requiredPasswordUpdateToken!);
        expect(unsealed).toEqual({ id: 42, token: 7 });
    });

    it('enforces password strength and token validity in signInPasswordUpdateAction', async () => {
        const token = await sealPasswordResetRequest({ id: 42, token: 7 });

        // Weak password rejected before any DB query:
        const weak = await signInPasswordUpdateAction({
            password: 'short',
            passwordResetRequest: token,
        });
        expect(weak.success).toBe(false);
        expect(weak.error).toBeTruthy();

        // Tampered token rejected cleanly without throwing:
        const tampered = await signInPasswordUpdateAction({
            password: 'StrongPassword1',
            passwordResetRequest: 'v1.bad.token',
        });
        expect(tampered.success).toBe(false);

        // Valid update writes Argon2id hash, revokes sessions, and creates a persistent session:
        let storedHash: string | undefined;
        expectAuthenticationQuery(mockConnection, { userId: 42 });
        mockConnection.expect('beginTransaction');
        mockConnection.expect('delete', () => 1);
        mockConnection.expect('insert', (_query: string, params: any[]) => {
            storedHash = params[2];
            return 1;
        });
        mockConnection.expect('update', () => 1);
        mockConnection.expect('commit');
        mockConnection.expect('delete', () => 0);
        mockConnection.expect('insertReturningLastInsertedId', () => 201);

        const updated = await signInPasswordUpdateAction({
            password: 'StrongPassword1',
            passwordResetRequest: token,
        });
        expect(updated).toEqual({ success: true });
        expect(storedHash).toMatch(/^\$argon2id\$v=19\$/);

        const cookie = await unsealSession(mockJar.get(kSessionCookieName)!.value);
        expect(cookie).toMatchObject({ sessionId: 201, userId: 42 });
    });

    it('rejects passkey sign-in for unactivated accounts or missing challenge cookies',
        async () =>
    {
        // Unactivated user is rejected immediately:
        mockConnection.expect('selectOneRow', () => ({ id: 7, activated: false }));
        const inactive = await signInPasskeyAction({
            username: 'pending@example.com',
            verification: { id: 'abc' } as any,
        });
        expect(inactive).toEqual({ success: false });

        // Activated user without challenge cookie is rejected:
        mockConnection.expect('selectOneRow', () => ({ id: 42, activated: true }));
        const noChallenge = await signInPasskeyAction({
            username: 'alice@example.com',
            verification: { id: 'abc' } as any,
        });
        expect(noChallenge.success).toBe(false);
        expect(noChallenge.error).toContain('expired');
    });

    it('revokes persistent sessions on signOutAction', async () => {
        const secret = 'session-secret-to-revoke';
        const passwordHash = await hashPassword('CorrectHorse1');

        mockConnection.expect('selectOneColumnOneRow', () => 42);
        mockConnection.expect('selectManyRows', () => [
            { authType: kAuthType.password, authValue: passwordHash },
        ]);
        mockConnection.expect('insertReturningLastInsertedId', () => 301);

        await signInPasswordAction({ username: 'alice@example.com', password: 'CorrectHorse1' });
        const sealedCookie = await unsealSession(mockJar.get(kSessionCookieName)!.value) as any;

        mockConnection.expect('selectOneRow', () => ({
            sessionId: 301,
            userId: 42,
            sessionTokenHash: hashSessionSecret(sealedCookie.secret ?? secret),
            impersonatorUserId: null,
            impersonatorReturnUrl: null,
        }));
        mockConnection.expect('delete', () => 1);

        const signedOut = await signOutAction();
        expect(signedOut).toEqual({ success: true, returnUrl: undefined });
        expect(mockJar.get(kSessionCookieName)?.value).toBe('');
    });
});
