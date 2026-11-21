// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { getAccessFallbackHTTPStatus, isHTTPAccessFallbackError }
    from 'next/dist/client/components/http-access-fallback/http-access-fallback';

import { stringifySetCookie } from 'cookie';

import type { SessionData } from './Session';
import { AccessControl } from './access/AccessControl';
import { buildAuthenticationContext, expectAuthenticationQuery } from './AuthenticationTestHelpers';
import { clearAuthCache, executeAccessCheck, getAuthenticationContextFromHeaders,
    invalidateUserAuthCache } from './AuthenticationContext';
import { hashSessionSecret } from './SessionStore';
import { initialisePermissionRoles } from './access/PermissionRoles';
import { kSessionCookieName, sealSession } from './Session';
import { useMockConnection } from '../database/Connection';

describe('AuthenticationContext', () => {
    const mockConnection = useMockConnection();

    beforeEach(async () => {
        clearAuthCache();
        await initialisePermissionRoles([]);
    });

    it('authenticates and caches server-backed per-device sessions across multiple devices',
        async () =>
    {
        const makeHeaders = async (session: SessionData) => new Headers([[
            'Cookie',
            stringifySetCookie({
                name: kSessionCookieName,
                value: await sealSession(session),
                httpOnly: true,
            }),
        ]]);

        const deviceA = await makeHeaders({ sessionId: 101, userId: 42, secret: 'secret-a' });
        const deviceB = await makeHeaders({ sessionId: 102, userId: 42, secret: 'secret-b' });

        // Device A misses cache: verifies session row, loads user, touches last_seen:
        mockConnection.expect('selectOneRow', () => ({
            sessionId: 101,
            userId: 42,
            sessionTokenHash: hashSessionSecret('secret-a'),
            impersonatorUserId: null,
            impersonatorReturnUrl: null,
        }));
        expectAuthenticationQuery(mockConnection, { userId: 42, firstName: 'Alice' });
        mockConnection.expect('update', () => 1);

        const firstA = await getAuthenticationContextFromHeaders(deviceA);
        expect(firstA.user?.firstName).toBe('Alice');

        // Repeat request from Device A hits cache with zero DB queries:
        const secondA = await getAuthenticationContextFromHeaders(deviceA);
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

        const bypassed = await getAuthenticationContextFromHeaders(deviceA, true);
        expect(bypassed.user?.firstName).toBe('Alice Updated');

        // Device B verifies once and merges into the user's cached session map without evicting A:
        mockConnection.expect('selectOneRow', () => ({
            sessionId: 102,
            userId: 42,
            sessionTokenHash: hashSessionSecret('secret-b'),
            impersonatorUserId: null,
            impersonatorReturnUrl: null,
        }));
        expectAuthenticationQuery(mockConnection, { userId: 42, firstName: 'Alice' });
        mockConnection.expect('update', () => 1);

        const firstB = await getAuthenticationContextFromHeaders(deviceB);
        expect(firstB.user?.firstName).toBe('Alice');

        // Both Device A and Device B now hit cache with zero DB queries:
        expect((await getAuthenticationContextFromHeaders(deviceA)).user?.firstName).toBe('Alice');
        expect((await getAuthenticationContextFromHeaders(deviceB)).user?.firstName).toBe('Alice');

        // Wrong secret does not hit cache and fails DB verification:
        const forgedA = await makeHeaders({ sessionId: 101, userId: 42, secret: 'wrong-secret' });
        mockConnection.expect('selectOneRow', () => ({
            sessionId: 101,
            userId: 42,
            sessionTokenHash: hashSessionSecret('secret-a'),
            impersonatorUserId: null,
            impersonatorReturnUrl: null,
        }));
        expect((await getAuthenticationContextFromHeaders(forgedA)).user).toBeUndefined();

        // Targeted invalidation forces Device A to re-verify against the database:
        invalidateUserAuthCache(42);
        mockConnection.expect('selectOneRow', () => undefined);
        expect((await getAuthenticationContextFromHeaders(deviceA)).user).toBeUndefined();

        // Global clear evicts all cached entries:
        clearAuthCache();
        mockConnection.expect('selectOneRow', () => undefined);
        expect((await getAuthenticationContextFromHeaders(deviceB)).user).toBeUndefined();
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
