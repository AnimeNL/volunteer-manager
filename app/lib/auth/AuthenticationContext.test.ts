// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { getAccessFallbackHTTPStatus, isHTTPAccessFallbackError }
    from 'next/dist/client/components/http-access-fallback/http-access-fallback';

import { AccessControl } from './AccessControl';
import { type SessionData, kSessionCookieName, sealSession } from './Session';
import { executeAccessCheck, getAuthenticationContextFromHeaders, initialisePermissionRoles }
    from './AuthenticationContext';
import { buildAuthenticationContext, expectAuthenticationQuery } from './AuthenticationTestHelpers';
import { stringifySetCookie } from 'cookie';
import { useMockConnection } from '../database/Connection';

describe('AuthenticationContext', () => {
    const mockConnection = useMockConnection();

    beforeEach(async () => {
        await initialisePermissionRoles([]);
    });

    it('is able to authenticate users based on valid session data', async () => {
        const sessionData: SessionData = {
            id: 42,
            token: 9001,
        };

        const sealedSession = await sealSession(sessionData);
        expect(sealedSession.length).toBeGreaterThan(0);

        const sealedCookie = stringifySetCookie({
            name: kSessionCookieName,
            value: sealedSession,
            httpOnly: true
        });
        expect(sealedCookie.length).toBeGreaterThan(0);

        const headers = new Headers([ ['Cookie', sealedCookie ] ]);
        expect(headers.has('Cookie')).toBeTruthy();

        // Intercepts the authentication SQL query that will be fired in order to validate the
        // information contained within the `sessionData`. Validate the parameters, otherwise pass.
        expectAuthenticationQuery(mockConnection);

        const { user } = await getAuthenticationContextFromHeaders(headers);
        expect(user).not.toBeUndefined();

        expect(user?.firstName).toEqual('Joe');
        expect(user?.lastName).toEqual('Example');
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
