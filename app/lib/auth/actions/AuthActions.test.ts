// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { vi } from 'vitest';

vi.mock('next/headers', async () => {
    const { getMockHeaders, mockCookieStore } = await import('./ActionTestHelpers');
    return { cookies: async () => mockCookieStore, headers: async () => getMockHeaders() };
});

vi.mock('next/server', () => ({ after: () => {} }));

import { checkRateLimit } from '../RateLimit';
import { confirmIdentityAction, signInPasskeyAction, signInPasswordAction,
    signInPasswordUpdateAction, signOutAction } from './AuthActions';
import { expectSetUserPassword, getMockHeaders, mockCookieJar, resetAuthActionTestState }
    from './ActionTestHelpers';
import { hashPassword } from '../Password';
import { hashSessionSecret } from '../SessionStore';
import { kSessionCookieName, unsealSession } from '../Session';
import { sealPasswordResetRequest, unsealPasswordResetRequest } from '../Tokens';
import { useMockConnection } from '../../database/Connection';

import { kAuthRateLimits } from '../RateLimit';
import { kAuthType } from '../../database/Types';

describe('AuthActions', () => {
    const mockConnection = useMockConnection();

    beforeEach(() => resetAuthActionTestState('203.0.113.10'));

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
        expect(result.authenticationOptions?.optionsJSON.userVerification).toBe('required');
        expect(mockCookieJar.get('passkey_challenge')?.value).toBeTruthy();
        expect(mockCookieJar.get('passkey_challenge')?.options.httpOnly).toBe(true);
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

        const cookie = unsealSession(mockCookieJar.get(kSessionCookieName)!.value);
        expect(cookie).toMatchObject({ sessionId: 105, userId: 42 });

        // Access code sign-in consumes the code and returns a sealed password update token:
        const codeHash = await hashPassword('ABCD-2345');
        mockConnection.expect('selectOneColumnOneRow', () => 42);
        mockConnection.expect('selectManyRows', () => [
            { authType: kAuthType.code, authValue: codeHash },
        ]);
        mockConnection.expect('delete', () => 1);
        mockConnection.expect('selectOneColumnOneRow', () => 7);

        const codeResult = await signInPasswordAction({
            username: 'alice@example.com',
            password: 'ABCD-2345',
        });
        expect(codeResult.success).toBe(true);
        expect(codeResult.requiredPasswordUpdateToken).toBeTruthy();

        const unsealed = unsealPasswordResetRequest(codeResult.requiredPasswordUpdateToken!);
        expect(unsealed).toEqual({ id: 42, token: 7 });

        // Once an IP hits `signin-ip`, further requests short-circuit without locking out accounts:
        getMockHeaders().set('x-forwarded-for', '198.51.100.99');
        for (let i = 0; i < kAuthRateLimits.signInByIp.limit; ++i)
            checkRateLimit('signin-ip', '198.51.100.99', kAuthRateLimits.signInByIp);

        for (let i = 0; i < kAuthRateLimits.signInByAccount.limit; ++i) {
            const blocked = await signInPasswordAction({
                username: 'victim@example.com',
                password: 'WrongPassword1',
            });
            expect(blocked.success).toBe(false);
        }

        expect(checkRateLimit(
            'signin-account', 'victim@example.com', { limit: 1, windowSeconds: 60 }).allowed)
            .toBe(true);
    });

    it('enforces password strength and token validity in signInPasswordUpdateAction', async () => {
        const token = sealPasswordResetRequest({ id: 42, token: 7 });

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
        mockConnection.expect('selectOneRow', () => ({ id: 42, firstName: 'Alice' }));
        expectSetUserPassword(mockConnection, { onInsertHash: hash => { storedHash = hash; } });
        mockConnection.expect('insertReturningLastInsertedId', () => 201);

        const updated = await signInPasswordUpdateAction({
            password: 'StrongPassword1',
            passwordResetRequest: token,
        });
        expect(updated).toEqual({ success: true });
        expect(storedHash).toMatch(/^\$argon2id\$v=19\$/);

        const cookie = unsealSession(mockCookieJar.get(kSessionCookieName)!.value);
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

        // Malformed WebAuthn assertion fails gracefully rather than throwing an unhandled error:
        const credBytes = Buffer.from('cred-id-bytes');
        const credBase64Url = credBytes.toString('base64url');
        mockConnection.expect('selectOneRow', () => ({ id: 42, activated: true }));
        mockConnection.expect('selectManyRows', () => [
            {
                passkeyId: 5,
                name: 'Laptop',
                credentialId: credBytes,
                credentialPublicKey: Buffer.from('pub-key-bytes'),
                counter: 1n,
                created: '2026-06-01 12:00:00',
                lastUsed: null,
            },
        ]);
        await confirmIdentityAction({ username: 'alice@example.com' });

        mockConnection.expect('selectOneRow', () => ({ id: 42, activated: true }));
        mockConnection.expect('selectManyRows', () => [
            {
                passkeyId: 5,
                name: 'Laptop',
                credentialId: credBytes,
                credentialPublicKey: Buffer.from('pub-key-bytes'),
                counter: 1n,
                created: '2026-06-01 12:00:00',
                lastUsed: null,
            },
        ]);
        const malformed = await signInPasskeyAction({
            username: 'alice@example.com',
            verification: { id: credBase64Url, rawId: 'mismatch', type: 'public-key' } as any,
        });
        expect(malformed).toEqual({
            success: false,
            error: 'Unable to verify the authentication response.',
        });
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
        const sealedCookie = unsealSession(mockCookieJar.get(kSessionCookieName)!.value) as any;

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
        expect(mockCookieJar.get(kSessionCookieName)?.value).toBe('');
    });
});
