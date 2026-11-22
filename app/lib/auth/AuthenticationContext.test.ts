// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { getAccessFallbackHTTPStatus, isHTTPAccessFallbackError }
    from 'next/dist/client/components/http-access-fallback/http-access-fallback';

const cookieStoreData = new Map<string, string>();

vi.mock('next/headers', () => ({
    cookies: async () => ({
        get: (name: string) => {
            const value = cookieStoreData.get(name);
            return value !== undefined ? { name, value } : undefined;
        },
        set: (name: string, value: string) => {
            cookieStoreData.set(name, value);
        },
    }),
    headers: async () => new Headers(),
}));

import type { SessionData } from './Session';
import { AccessControl } from './access/AccessControl';
import { buildAuthenticationContext, expectAuthenticationQuery } from './AuthenticationTestHelpers';
import { getAuthenticationContext, impersonateUser, invalidateAuthCache,
    requireAuthenticationContext } from './AuthenticationContext';
import { executeAccessCheck } from './access/PermissionCheck';
import { hashSessionSecret } from './SessionStore';
import { initialisePermissionRoles } from './access/PermissionRoles';
import { kSessionCookieName, sealSession, unsealSession } from './Session';
import { useMockConnection } from '../database/Connection';

async function expectHttpStatus(fn: () => unknown, status: 401 | 403): Promise<void> {
    try {
        await fn();
        expect.unreachable(`Expected HTTP ${status} error`);
    } catch (error: unknown) {
        expect(isHTTPAccessFallbackError(error)).toBe(true);
        expect(getAccessFallbackHTTPStatus(error as any)).toBe(status);
    }
}

describe('AuthenticationContext', () => {
    const mockConnection = useMockConnection();

    beforeEach(async () => {
        cookieStoreData.clear();
        invalidateAuthCache();
        await initialisePermissionRoles([]);
    });

    it('authenticates and caches server-backed per-device sessions across multiple devices',
        async () =>
    {
        const setSessionCookie = async (session: SessionData) => {
            cookieStoreData.set(kSessionCookieName, sealSession(session));
        };

        const deviceA: SessionData = { sessionId: 101, userId: 42, secret: 'secret-a' };
        const deviceB: SessionData = { sessionId: 102, userId: 42, secret: 'secret-b' };

        // Device A misses cache: verifies session row, loads user, touches last_seen:
        await setSessionCookie(deviceA);
        mockConnection.expect('selectOneRow', () => ({
            sessionId: 101,
            userId: 42,
            sessionTokenHash: hashSessionSecret('secret-a'),
            impersonatorUserId: null,
            impersonatorReturnUrl: null,
        }));
        expectAuthenticationQuery(mockConnection, { userId: 42, firstName: 'Alice' });
        mockConnection.expect('update', () => 1);

        const firstA = await getAuthenticationContext();
        expect(firstA.user?.firstName).toBe('Alice');

        // Repeat request from Device A hits cache with zero DB queries:
        const secondA = await getAuthenticationContext();
        expect(secondA.user?.firstName).toBe('Alice');

        // bypassCache forces a fresh database verification and reload:
        mockConnection.expect('selectOneRow', () => ({
            sessionId: 101,
            userId: 42,
            sessionTokenHash: hashSessionSecret('secret-a'),
            impersonatorUserId: null,
            impersonatorReturnUrl: null,
        }));
        expectAuthenticationQuery(mockConnection, { userId: 42, firstName: 'Alice Updated' });
        mockConnection.expect('update', () => 1);

        const bypassed = await requireAuthenticationContext(
            undefined, undefined, { bypassCache: true });
        expect(bypassed.user.firstName).toBe('Alice Updated');

        // Device B verifies once and merges into the user's cached session map without evicting A:
        await setSessionCookie(deviceB);
        mockConnection.expect('selectOneRow', () => ({
            sessionId: 102,
            userId: 42,
            sessionTokenHash: hashSessionSecret('secret-b'),
            impersonatorUserId: null,
            impersonatorReturnUrl: null,
        }));
        expectAuthenticationQuery(mockConnection, { userId: 42, firstName: 'Alice' });
        mockConnection.expect('update', () => 1);

        const firstB = await getAuthenticationContext();
        expect(firstB.user?.firstName).toBe('Alice');

        // Both Device A and Device B now hit cache with zero DB queries:
        await setSessionCookie(deviceA);
        expect((await getAuthenticationContext()).user?.firstName).toBe('Alice');
        await setSessionCookie(deviceB);
        expect((await getAuthenticationContext()).user?.firstName).toBe('Alice');

        // Wrong secret does not hit cache and fails DB verification:
        await setSessionCookie({ sessionId: 101, userId: 42, secret: 'wrong-secret' });
        mockConnection.expect('selectOneRow', () => ({
            sessionId: 101,
            userId: 42,
            sessionTokenHash: hashSessionSecret('secret-a'),
            impersonatorUserId: null,
            impersonatorReturnUrl: null,
        }));
        expect((await getAuthenticationContext()).user).toBeUndefined();

        // Targeted invalidation forces Device A to re-verify against the database:
        await setSessionCookie(deviceA);
        invalidateAuthCache(/* forUserId= */ 42);
        mockConnection.expect('selectOneRow', () => undefined);
        expect((await getAuthenticationContext()).user).toBeUndefined();

        // Global clear evicts all cached entries:
        await setSessionCookie(deviceB);
        invalidateAuthCache();
        mockConnection.expect('selectOneRow', () => undefined);
        expect((await getAuthenticationContext()).user).toBeUndefined();
    });

    it('executes permission checks and enforces requireAuthenticationContext()', async () => {
        // Unauthenticated visitors receive 401; authenticated users without permission receive 403:
        await expectHttpStatus(
            () => executeAccessCheck({ access: new AccessControl({}), user: undefined }, 'test.boolean'),
            401);
        await expectHttpStatus(
            () => executeAccessCheck(buildAuthenticationContext(), 'test.boolean'),
            403);

        executeAccessCheck(
            buildAuthenticationContext({ access: { grants: 'test.boolean' } }), 'test.boolean');

        // Scoped and CRUD permission checks:
        const scoped = buildAuthenticationContext({
            access: { grants: [ { permission: 'event.settings', event: '2026' } ] },
        });
        executeAccessCheck(scoped, { permission: 'event.settings', scope: { event: '2026' } });
        await expectHttpStatus(
            () => executeAccessCheck(
                scoped, { permission: 'event.settings', scope: { event: '2024' } }),
            403);

        const crud = buildAuthenticationContext({
            access: {
                grants: [
                    { permission: 'volunteers.participation:read', event: '2026', team: 'stewards' },
                ],
            },
        });
        executeAccessCheck(crud, {
            permission: 'volunteers.participation',
            operation: 'read',
            scope: { event: '2026', team: 'stewards' },
        });
        await expectHttpStatus(
            () => executeAccessCheck(crud, {
                permission: 'volunteers.participation',
                operation: 'update',
                scope: { event: '2026', team: 'stewards' },
            }),
            403);

        // requireAuthenticationContext() throws 401 for visitors, 403 for missing permission:
        await expectHttpStatus(() => requireAuthenticationContext(), 401);

        cookieStoreData.set(kSessionCookieName, sealSession({
            sessionId: 201, userId: 7, secret: 'req-secret',
        }));
        mockConnection.expect('selectOneRow', () => ({
            sessionId: 201,
            userId: 7,
            sessionTokenHash: hashSessionSecret('req-secret'),
            impersonatorUserId: null,
            impersonatorReturnUrl: null,
        }));
        expectAuthenticationQuery(mockConnection, {
            userId: 7,
            firstName: 'Bob',
            accessControl: { grants: 'test.boolean' },
        });
        mockConnection.expect('update', () => 1);

        const ctx = await requireAuthenticationContext('test.boolean');
        expect(ctx.user.firstName).toBe('Bob');
        await expectHttpStatus(() => requireAuthenticationContext('root'), 403);

        // When `bypassCache` fails verification, the stale cache entry is evicted:
        mockConnection.expect('selectOneRow', () => undefined);
        await expectHttpStatus(
            () => requireAuthenticationContext(undefined, undefined, { bypassCache: true }), 401);

        mockConnection.expect('selectOneRow', () => undefined);
        expect((await getAuthenticationContext()).user).toBeUndefined();
    });

    it('impersonates active accounts and rejects missing or inactive accounts', async () => {
        // Without a verified prior session, impersonation is rejected with zero DB queries:
        const unauthenticated = await impersonateUser(999, {
            impersonatorUserId: 1,
            returnUrl: '/admin/organisation/accounts/999',
        });
        expect(unauthenticated).toBeUndefined();
        expect(cookieStoreData.has(kSessionCookieName)).toBe(false);

        // Missing or inactive target returns undefined without revoking or writing a cookie:
        const adminCookie = sealSession({
            sessionId: 300, userId: 1, secret: 'admin-secret',
        });
        cookieStoreData.set(kSessionCookieName, adminCookie);
        mockConnection.expect('selectOneRow', () => ({
            sessionId: 300,
            userId: 1,
            sessionTokenHash: hashSessionSecret('admin-secret'),
            impersonatorUserId: null,
            impersonatorReturnUrl: null,
        }));
        mockConnection.expect('selectOneRow', () => undefined);
        const missing = await impersonateUser(999, {
            impersonatorUserId: 1,
            returnUrl: '/admin/organisation/accounts/999',
        });
        expect(missing).toBeUndefined();
        expect(cookieStoreData.get(kSessionCookieName)).toBe(adminCookie);

        // Mismatched impersonatorUserId is rejected:
        mockConnection.expect('selectOneRow', () => ({
            sessionId: 300,
            userId: 1,
            sessionTokenHash: hashSessionSecret('admin-secret'),
            impersonatorUserId: null,
            impersonatorReturnUrl: null,
        }));
        const mismatched = await impersonateUser(55, {
            impersonatorUserId: 99,
            returnUrl: '/admin/organisation/accounts/55',
        });
        expect(mismatched).toBeUndefined();

        // Failed atomic revocation of the prior session aborts without creating a new session:
        mockConnection.expect('selectOneRow', () => ({
            sessionId: 300,
            userId: 1,
            sessionTokenHash: hashSessionSecret('admin-secret'),
            impersonatorUserId: null,
            impersonatorReturnUrl: null,
        }));
        expectAuthenticationQuery(mockConnection, { userId: 55, firstName: 'Target' });
        mockConnection.expect('delete', () => 0);
        const failedRevoke = await impersonateUser(55, {
            impersonatorUserId: 1,
            returnUrl: '/admin/organisation/accounts/55',
        });
        expect(failedRevoke).toBeUndefined();
        expect(cookieStoreData.get(kSessionCookieName)).toBe(adminCookie);

        // Active target revokes the admin's prior session and writes an impersonation cookie:
        mockConnection.expect('selectOneRow', () => ({
            sessionId: 300,
            userId: 1,
            sessionTokenHash: hashSessionSecret('admin-secret'),
            impersonatorUserId: null,
            impersonatorReturnUrl: null,
        }));
        expectAuthenticationQuery(mockConnection, { userId: 55, firstName: 'Target' });
        mockConnection.expect('delete', (_query, params) => {
            expect(params).toEqual([ 300, 1 ]);
            return 1;
        });
        mockConnection.expect('insertReturningLastInsertedId', () => 303);

        const impersonated = await impersonateUser(55, {
            impersonatorUserId: 1,
            returnUrl: '/admin/organisation/accounts/55',
            ip: '203.0.113.5',
        });
        expect(impersonated?.id).toBe(55);
        expect(impersonated?.firstName).toBe('Target');

        const sealedCookie = cookieStoreData.get(kSessionCookieName);
        expect(sealedCookie).toBeDefined();
        const session = unsealSession(sealedCookie!);
        expect(session.sessionId).toBe(303);
        expect(session.userId).toBe(55);

        // Self-impersonation is rejected with zero DB queries and preserves the existing cookie:
        const selfAttempt = await impersonateUser(1, {
            impersonatorUserId: 1,
            returnUrl: '/admin',
        });
        expect(selfAttempt).toBeUndefined();
        expect(cookieStoreData.get(kSessionCookieName)).toBe(sealedCookie);

        // Nested impersonation is rejected without revoking or overwriting the existing cookie:
        const nestedCookie = sealSession({
            sessionId: 301, userId: 2, secret: 'imp-secret',
        });
        cookieStoreData.set(kSessionCookieName, nestedCookie);
        mockConnection.expect('selectOneRow', () => ({
            sessionId: 301,
            userId: 2,
            sessionTokenHash: hashSessionSecret('imp-secret'),
            impersonatorUserId: 1,
            impersonatorReturnUrl: '/admin',
        }));

        const nestedAttempt = await impersonateUser(55, {
            impersonatorUserId: 2,
            returnUrl: '/admin',
        });
        expect(nestedAttempt).toBeUndefined();
        expect(cookieStoreData.get(kSessionCookieName)).toBe(nestedCookie);
    });
});
