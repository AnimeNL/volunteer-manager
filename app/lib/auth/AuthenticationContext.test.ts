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
import { clearAuthCache, executeAccessCheck, getAuthenticationContext, invalidateUserAuthCache,
    requireAuthenticationContext } from './AuthenticationContext';
import { hashSessionSecret } from './SessionStore';
import { initialisePermissionRoles } from './access/PermissionRoles';
import { kSessionCookieName, sealSession } from './Session';
import { useMockConnection } from '../database/Connection';

describe('AuthenticationContext', () => {
    const mockConnection = useMockConnection();

    beforeEach(async () => {
        cookieStoreData.clear();
        clearAuthCache();
        await initialisePermissionRoles([]);
    });

    it('authenticates and caches server-backed per-device sessions across multiple devices',
        async () =>
    {
        const setSessionCookie = async (session: SessionData) => {
            cookieStoreData.set(kSessionCookieName, await sealSession(session));
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
        invalidateUserAuthCache(42);
        mockConnection.expect('selectOneRow', () => undefined);
        expect((await getAuthenticationContext()).user).toBeUndefined();

        // Global clear evicts all cached entries:
        await setSessionCookie(deviceB);
        clearAuthCache();
        mockConnection.expect('selectOneRow', () => undefined);
        expect((await getAuthenticationContext()).user).toBeUndefined();
    });

    it('is able to execute permission access checks', () => {
        // Case (1): Unauthenticated visitors receive 401 Unauthorized
        const visitorAuthenticationContext = { access: new AccessControl({}), user: undefined };
        try {
            executeAccessCheck(visitorAuthenticationContext, 'test.boolean');
            expect.unreachable('executeAccessCheck was expected to throw');
        } catch (error: any) {
            expect(isHTTPAccessFallbackError(error)).toBeTruthy();
            expect(getAccessFallbackHTTPStatus(error)).toBe(401);
        }

        // Case (2): Authenticated user without the permission receives 403 Forbidden
        const userWithoutPermContext = buildAuthenticationContext();
        try {
            executeAccessCheck(userWithoutPermContext, 'test.boolean');
            expect.unreachable('executeAccessCheck was expected to throw');
        } catch (error: any) {
            expect(isHTTPAccessFallbackError(error)).toBeTruthy();
            expect(getAccessFallbackHTTPStatus(error)).toBe(403);
        }

        // Case (3): Authenticated user with the granted permission passes
        const userWithPermContext = buildAuthenticationContext({
            access: {
                grants: 'test.boolean',
            },
        });
        executeAccessCheck(userWithPermContext, 'test.boolean');

        // Case (4): Scoped permission check (event match passes, event mismatch fails)
        const userWithScopedPermContext = buildAuthenticationContext({
            access: {
                grants: [
                    { permission: 'event.settings', event: '2026' },
                ],
            },
        });
        executeAccessCheck(userWithScopedPermContext, {
            permission: 'event.settings',
            scope: { event: '2026' },
        });

        try {
            executeAccessCheck(userWithScopedPermContext, {
                permission: 'event.settings',
                scope: { event: '2024' },
            });
            expect.unreachable('executeAccessCheck was expected to throw');
        } catch (error: any) {
            expect(isHTTPAccessFallbackError(error)).toBeTruthy();
            expect(getAccessFallbackHTTPStatus(error)).toBe(403);
        }

        // Case (5): CRUD permission check
        const userWithCrudPermContext = buildAuthenticationContext({
            access: {
                grants: [
                    { permission: 'volunteers.participation:read', event: '2026', team: 'stewards' }
                ],
            },
        });
        executeAccessCheck(userWithCrudPermContext, {
            permission: 'volunteers.participation',
            operation: 'read',
            scope: { event: '2026', team: 'stewards' },
        });

        try {
            executeAccessCheck(userWithCrudPermContext, {
                permission: 'volunteers.participation',
                operation: 'update',
                scope: { event: '2026', team: 'stewards' },
            });
            expect.unreachable('executeAccessCheck was expected to throw');
        } catch (error: any) {
            expect(isHTTPAccessFallbackError(error)).toBeTruthy();
            expect(getAccessFallbackHTTPStatus(error)).toBe(403);
        }
    });
});
