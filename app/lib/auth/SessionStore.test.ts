// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Cache } from '@lib/cache';
import { createAndWriteUserSessionCookie, createUserSession, hashSessionSecret,
    revokeAllUserSessions, revokeAndClearCurrentSessionCookie, revokeUserSession,
    verifyUserSession } from './SessionStore';
import { kSessionCookieName, unsealSession } from './Session';
import { useMockConnection } from '../database/Connection';

describe('SessionStore', () => {
    const mockConnection = useMockConnection();

    it('creates a session storing only the SHA-256 hash of the random secret', async () => {
        let insertedParams: any[] = [];

        mockConnection.expect('insertReturningLastInsertedId', (_query: string, params: any[]) => {
            insertedParams = params;
            return 77;
        });

        const created = await createUserSession({
            userId: 42,
            impersonatorReturnUrl: 'https://evil.example.com',
            ip: '203.0.113.5',
            userAgent: 'TestAgent/1.0',
        });

        expect(created.sessionId).toBe(77);
        expect(created.userId).toBe(42);
        expect(created.secret.length).toBeGreaterThanOrEqual(40);
        expect(insertedParams).toContain(hashSessionSecret(created.secret));
        expect(insertedParams).not.toContain(created.secret);
        expect(insertedParams).not.toContain('https://evil.example.com');
    });

    it('verifies matching secrets and rejects mismatched or missing sessions', async () => {
        const secret = 'valid-random-session-secret-value';
        const storedHash = hashSessionSecret(secret);

        mockConnection.expect('selectOneRow', () => ({
            sessionId: 77,
            userId: 42,
            sessionTokenHash: storedHash,
            impersonatorUserId: 1,
            impersonatorReturnUrl: '/admin/organisation/accounts/42',
        }));

        await expect(verifyUserSession(77, secret)).resolves.toEqual({
            sessionId: 77,
            userId: 42,
            impersonatorUserId: 1,
            impersonatorReturnUrl: '/admin/organisation/accounts/42',
        });

        // Wrong secret fails constant-time comparison:
        mockConnection.expect('selectOneRow', () => ({
            sessionId: 77,
            userId: 42,
            sessionTokenHash: storedHash,
            impersonatorUserId: null,
            impersonatorReturnUrl: null,
        }));

        await expect(verifyUserSession(77, 'wrong-secret')).resolves.toBeUndefined();

        // Missing or expired row returns undefined:
        mockConnection.expect('selectOneRow', () => undefined);
        await expect(verifyUserSession(999, secret)).resolves.toBeUndefined();
    });

    it('revokes individual sessions, user sessions, and initiated impersonation sessions',
        async () =>
    {
        const authCache = Cache.getInstance('Authentication');
        authCache.set(42, { context: {} as any, sessions: new Map() });
        authCache.set(99, { context: {} as any, sessions: new Map() });

        mockConnection.expect('delete', () => 1);
        await revokeUserSession(77, 42);
        expect(authCache.has(42)).toBe(false);

        authCache.set(42, { context: {} as any, sessions: new Map() });
        mockConnection.expect('selectOneColumnManyRows', () => [ 99 ]);
        mockConnection.expect('delete', (query, params) => {
            expect(query).toContain('impersonator_user_id');
            expect(params).toEqual([ 42, 42, 77 ]);
            return 3;
        });

        await revokeAllUserSessions(42, 77);
        expect(authCache.has(42)).toBe(false);
        expect(authCache.has(99)).toBe(false);
    });

    it('writes persistent session cookies and restores impersonator sessions on sign-out',
        async () =>
    {
        const jar = new Map<string, { value: string; options: any }>();
        const cookieStore = {
            get: (name: string) => {
                const entry = jar.get(name);
                return entry ? { name, value: entry.value } : undefined;
            },
            set: (name: string, value: string, options: any) => {
                jar.set(name, { value, options });
            },
        } as any;

        // Create an impersonation session cookie:
        mockConnection.expect('insertReturningLastInsertedId', () => 88);
        const impersonation = await createAndWriteUserSessionCookie(cookieStore, {
            userId: 42,
            impersonatorUserId: 1,
            impersonatorReturnUrl: '/admin/organisation/accounts/42',
        });

        expect(jar.get(kSessionCookieName)?.options.httpOnly).toBe(true);
        expect(jar.get(kSessionCookieName)?.options.sameSite).toBe('lax');

        // Signing out revokes the impersonation session and restores the impersonator:
        mockConnection.expect('selectOneRow', () => ({
            sessionId: 88,
            userId: 42,
            sessionTokenHash: hashSessionSecret(impersonation.secret),
            impersonatorUserId: 1,
            impersonatorReturnUrl: '/admin/organisation/accounts/42',
        }));
        mockConnection.expect('delete', () => 1);
        mockConnection.expect('selectOneColumnOneRow', () => 1);
        mockConnection.expect('insertReturningLastInsertedId', () => 89);

        const restored = await revokeAndClearCurrentSessionCookie(cookieStore);
        expect(restored).toEqual({
            restoredImpersonator: true,
            returnUrl: '/admin/organisation/accounts/42',
        });

        const restoredCookie = await unsealSession(jar.get(kSessionCookieName)!.value);
        expect(restoredCookie).toMatchObject({ sessionId: 89, userId: 1 });

        // Signing out again (non-impersonated) clears the cookie completely:
        mockConnection.expect('selectOneRow', () => ({
            sessionId: 89,
            userId: 1,
            sessionTokenHash: hashSessionSecret((restoredCookie as any).secret),
            impersonatorUserId: null,
            impersonatorReturnUrl: null,
        }));
        mockConnection.expect('delete', () => 1);

        const signedOut = await revokeAndClearCurrentSessionCookie(cookieStore);
        expect(signedOut).toEqual({ restoredImpersonator: false });
        expect(jar.get(kSessionCookieName)?.value).toBe('');
        expect(jar.get(kSessionCookieName)?.options.maxAge).toBe(0);

        // Pre-existing unsafe impersonatorReturnUrl in DB is sanitized to undefined on restore:
        mockConnection.expect('insertReturningLastInsertedId', () => 90);
        const unsafeSession = await createAndWriteUserSessionCookie(cookieStore, {
            userId: 42,
            impersonatorUserId: 1,
        });
        mockConnection.expect('selectOneRow', () => ({
            sessionId: 90,
            userId: 42,
            sessionTokenHash: hashSessionSecret(unsafeSession.secret),
            impersonatorUserId: 1,
            impersonatorReturnUrl: '//evil.example.com/phish',
        }));
        mockConnection.expect('delete', () => 1);
        mockConnection.expect('selectOneColumnOneRow', () => 1);
        mockConnection.expect('insertReturningLastInsertedId', () => 91);

        await expect(revokeAndClearCurrentSessionCookie(cookieStore)).resolves.toEqual({
            restoredImpersonator: true,
            returnUrl: undefined,
        });
    });
});
