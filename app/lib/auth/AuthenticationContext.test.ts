// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { getAccessFallbackHTTPStatus, isHTTPAccessFallbackError }
    from 'next/dist/client/components/http-access-fallback/http-access-fallback';

import { AccessControl } from './AccessControl';
import { type SessionData, kSessionCookieName, sealSession } from './Session';
import { executeAccessCheck, getAuthenticationContextFromHeaders } from './AuthenticationContext';
import { buildAuthenticationContext, expectAuthenticationQuery } from './AuthenticationTestHelpers';
import { serialize } from 'cookie';
import { useMockConnection } from '../database/Connection';

describe('AuthenticationContext', () => {
    const mockConnection = useMockConnection();

    it('is able to authenticate users based on valid session data', async () => {
        const sessionData: SessionData = {
            id: 42,
            token: 9001,
        };

        const sealedSession = await sealSession(sessionData);
        expect(sealedSession.length).toBeGreaterThan(0);

        const sealedCookie = serialize(kSessionCookieName, sealedSession, { httpOnly: true });
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

    it('is able to execute dedicated access checks: "admin"', () => {
        // Case (1): Visitors are never administrators
        const visitorAuthenticationContext = { access: new AccessControl({}), user: undefined };
        try {
            executeAccessCheck(visitorAuthenticationContext, { check: 'admin' });
            expect.unreachable('executeAccessCheck was expected to throw');
        } catch (error: any) {
            expect(isHTTPAccessFallbackError(error)).toBeTruthy();
            expect(getAccessFallbackHTTPStatus(error)).toBe(401);
        }

        // Case (2): Implicit administrators through a role assignment
        const implicitAdminAuthenticationContext = buildAuthenticationContext({
            access: {
                grants: 'event.visible',
            },
        });

        executeAccessCheck(implicitAdminAuthenticationContext, { check: 'admin' });

        // Case (3): Users without either are not administrators
        const userAuthenticationContext = buildAuthenticationContext();
        try {
            executeAccessCheck(userAuthenticationContext, { check: 'admin' });
            expect.unreachable('executeAccessCheck was expected to throw');
        } catch (error: any) {
            expect(isHTTPAccessFallbackError(error)).toBeTruthy();
            expect(getAccessFallbackHTTPStatus(error)).toBe(403);
        }
    });

    // TODO: Fix this test.
    it('is able to execute dedicated access checks: "admin-event"', () => {
        // Case (1): Visitors are never administrators
        const visitorAuthenticationContext = { access: new AccessControl({}), user: undefined };
        try {
            executeAccessCheck(visitorAuthenticationContext, { check: 'admin-event', event: 'XX' });
            expect.unreachable('executeAccessCheck was expected to throw');
        } catch (error: any) {
            expect(isHTTPAccessFallbackError(error)).toBeTruthy();
            expect(getAccessFallbackHTTPStatus(error)).toBe(401);
        }

        // Case (2): Explicit administrators through a permission
        const explicitAdminAuthenticationContext = buildAuthenticationContext({
            access: {
                grants: 'event.visible',
                events: '2024',
            },
        });

        executeAccessCheck(
            explicitAdminAuthenticationContext, { check: 'admin-event', event: '2024' });

        // Case (3): Participation in an event does not equate being granted access.
        const participationAuthenticationContext = buildAuthenticationContext({
            events: new Map([
                [ '2024', 'stewards' ],
            ]),
        });

        try {
            executeAccessCheck(
                participationAuthenticationContext, { check: 'admin-event', event: '2024' });

            expect.unreachable('executeAccessCheck was expected to throw');
        } catch (error: any) {
            expect(isHTTPAccessFallbackError(error)).toBeTruthy();
            expect(getAccessFallbackHTTPStatus(error)).toBe(403);
        }

        // Case (4): No administrator access when there is no assignment for the applicable event
        const wrongEventAuthenticationContext = buildAuthenticationContext({
            events: new Map([
                [ '2017', 'hosts' ],
            ]),
        });

        try {
            executeAccessCheck(
                wrongEventAuthenticationContext, { check: 'admin-event', event: '2024' });

            expect.unreachable('executeAccessCheck was expected to throw');
        } catch (error: any) {
            expect(isHTTPAccessFallbackError(error)).toBeTruthy();
            expect(getAccessFallbackHTTPStatus(error)).toBe(403);
        }

        // Case (5): Users without either are not administrators
        const userAuthenticationContext = buildAuthenticationContext();
        try {
            executeAccessCheck(userAuthenticationContext, { check: 'admin-event', event: '2024' });
            expect.unreachable('executeAccessCheck was expected to throw');
        } catch (error: any) {
            expect(isHTTPAccessFallbackError(error)).toBeTruthy();
            expect(getAccessFallbackHTTPStatus(error)).toBe(403);
        }
    });

    it('is able to execute dedicated access checks: "event"', () => {
        // Case (1): Visitors are never granted access
        const visitorAuthenticationContext = buildAuthenticationContext();
        try {
            executeAccessCheck(visitorAuthenticationContext, { check: 'event', event: '2025' });
            expect.unreachable('executeAccessCheck was expected to throw');
        } catch (error: any) {
            expect(isHTTPAccessFallbackError(error)).toBeTruthy();
            expect(getAccessFallbackHTTPStatus(error)).toBe(403);
        }

        // Case (2): Participants are granted access (w/o administrator access):
        const participantAuthenticationContext = buildAuthenticationContext({
            events: new Map([
                [ '2025', 'hosts.team' ],
            ]),
        });

        executeAccessCheck(participantAuthenticationContext, { check: 'event', event: '2025' });

        // Case (3): Participants are granted access (w/ administrator access):
        const administratorAuthenticationContext = buildAuthenticationContext({
            events: new Map([
                [ '2025', 'hosts.team' ],
            ]),
        });

        executeAccessCheck(administratorAuthenticationContext, { check: 'event', event: '2025' });
    });
});
