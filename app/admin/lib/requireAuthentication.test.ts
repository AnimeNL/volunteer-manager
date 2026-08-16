// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { getAccessFallbackHTTPStatus, isHTTPAccessFallbackError }
    from 'next/dist/client/components/http-access-fallback/http-access-fallback';

import type { CachedEvent, CachedTeam } from '@lib/cache';
import { AccessControl } from '@lib/auth/AccessControl';
import { Cache } from '@lib/cache';
import { buildAuthenticationContext } from '@lib/auth/AuthenticationTestHelpers';
import {
    requireAuthentication,
    requireAuthenticationWithEvent,
    requireAuthenticationWithEventAndTeam,
} from './requireAuthentication';
import { useMockConnection } from '@lib/database/Connection';

describe('requireAuthentication', () => {
    const mockConnection = useMockConnection();

    const kTestEvent: CachedEvent = {
        id: 10,
        slug: 'event-2026',
        name: 'AnimeCon 2026',
        shortName: '2026',
        published: true,
        startTime: '2026-06-05T12:00:00+02:00',
        endTime: '2026-06-07T18:00:00+02:00',
        timeZone: 'Europe/Amsterdam',
    };

    const kTestTeam: CachedTeam = {
        id: 20,
        slug: 'stewards',
        name: 'Stewards',
        color: {
            darkTheme: '#ff0000',
            lightTheme: '#cc0000',
        },
    };

    beforeEach(() => {
        const eventCache = Cache.getInstance('EventCache');
        eventCache.clear();
        eventCache.set(kTestEvent.slug, kTestEvent);

        const teamCache = Cache.getInstance('TeamCache');
        teamCache.clear();
        teamCache.set(kTestTeam.slug, kTestTeam);
    });

    describe('requireAuthentication', () => {
        it('allows access for global administrators', async () => {
            const context = buildAuthenticationContext({
                access: {
                    grants: 'event.visible',
                    events: '*',
                    teams: '*',
                },
            });

            const result = await requireAuthentication(context);
            expect(result.user).toEqual(context.user);
            expect(result.access).toBeInstanceOf(AccessControl);
        });

        it('verifies additional permissions when provided', async () => {
            const context = buildAuthenticationContext({
                access: {
                    grants: 'event.visible,statistics.finances',
                    events: '*',
                    teams: '*',
                },
            });

            // Granted permission
            const result = await requireAuthentication(context, 'statistics.finances');
            expect(result.user).toEqual(context.user);

            // Missing permission
            try {
                await requireAuthentication(context, 'system.internals');
                expect.unreachable('Expected requireAuthentication to throw 403');
            } catch (error: any) {
                expect(isHTTPAccessFallbackError(error)).toBeTruthy();
                expect(getAccessFallbackHTTPStatus(error)).toBe(403);
            }
        });

        it('rejects visitors without a logged-in user', async () => {
            const visitorContext = { access: new AccessControl({}), user: undefined };
            try {
                await requireAuthentication(visitorContext);
                expect.unreachable('Expected requireAuthentication to throw 401');
            } catch (error: any) {
                expect(isHTTPAccessFallbackError(error)).toBeTruthy();
                expect(getAccessFallbackHTTPStatus(error)).toBe(401);
            }
        });

        it('rejects users without administrative access', async () => {
            const context = buildAuthenticationContext({
                access: {
                    grants: 'volunteer.application',
                },
            });

            try {
                await requireAuthentication(context);
                expect.unreachable('Expected requireAuthentication to throw 403');
            } catch (error: any) {
                expect(isHTTPAccessFallbackError(error)).toBeTruthy();
                expect(getAccessFallbackHTTPStatus(error)).toBe(403);
            }
        });
    });

    describe('requireAuthenticationWithEvent', () => {
        it('allows access for users with event admin access', async () => {
            const context = buildAuthenticationContext({
                access: {
                    grants: [
                        { permission: 'event.visible', event: 'event-2026' },
                    ],
                },
            });

            const result = await requireAuthenticationWithEvent(context, 'event-2026');
            expect(result.user).toEqual(context.user);
            expect(result.event).toEqual(kTestEvent);
        });

        it('verifies event-level permissions', async () => {
            const context = buildAuthenticationContext({
                access: {
                    grants: [
                        { permission: 'event.visible', event: 'event-2026' },
                        { permission: 'event.settings', event: 'event-2026' },
                    ],
                },
            });

            const result = await requireAuthenticationWithEvent(
                context, 'event-2026', 'event.settings');
            expect(result.event).toEqual(kTestEvent);

            try {
                await requireAuthenticationWithEvent(
                    context, 'event-2026', 'statistics.finances');
                expect.unreachable('Expected requireAuthenticationWithEvent to throw 403');
            } catch (error: any) {
                expect(isHTTPAccessFallbackError(error)).toBeTruthy();
                expect(getAccessFallbackHTTPStatus(error)).toBe(403);
            }
        });

        it('throws notFound for non-existent events', async () => {
            const context = buildAuthenticationContext({
                access: {
                    grants: 'event.visible',
                    events: '*',
                    teams: '*',
                },
            });

            mockConnection.expect('selectOneRow', () => undefined);

            try {
                await requireAuthenticationWithEvent(context, 'non-existent-event');
                expect.unreachable('Expected requireAuthenticationWithEvent to throw notFound');
            } catch (error: any) {
                expect(isHTTPAccessFallbackError(error)).toBeTruthy();
                expect(getAccessFallbackHTTPStatus(error)).toBe(404);
            }
        });

        it('rejects users without access to the specific event', async () => {
            const context = buildAuthenticationContext({
                access: {
                    grants: [
                        { permission: 'event.visible', event: 'other-event' },
                    ],
                },
            });

            try {
                await requireAuthenticationWithEvent(context, 'event-2026');
                expect.unreachable('Expected requireAuthenticationWithEvent to throw 403');
            } catch (error: any) {
                expect(isHTTPAccessFallbackError(error)).toBeTruthy();
                expect(getAccessFallbackHTTPStatus(error)).toBe(403);
            }
        });
    });

    describe('requireAuthenticationWithEventAndTeam', () => {
        it('allows access for users with event and team admin access', async () => {
            const context = buildAuthenticationContext({
                access: {
                    grants: [
                        { permission: 'event.visible', event: 'event-2026', team: 'stewards' },
                    ],
                },
            });

            const result = await requireAuthenticationWithEventAndTeam(
                context, 'event-2026', 'stewards');
            expect(result.user).toEqual(context.user);
            expect(result.event).toEqual(kTestEvent);
            expect(result.team).toEqual(kTestTeam);
        });

        it('verifies team-level permissions', async () => {
            const context = buildAuthenticationContext({
                access: {
                    grants: [
                        {
                            permission: 'event.visible',
                            event: 'event-2026',
                            team: 'stewards',
                        },
                        {
                            permission: 'event.applications:read',
                            event: 'event-2026',
                            team: 'stewards',
                        },
                    ],
                },
            });

            const result = await requireAuthenticationWithEventAndTeam(
                context, 'event-2026', 'stewards', {
                    permission: 'event.applications',
                    operation: 'read',
                });
            expect(result.team).toEqual(kTestTeam);

            try {
                await requireAuthenticationWithEventAndTeam(
                    context, 'event-2026', 'stewards', {
                        permission: 'event.applications',
                        operation: 'update',
                    });
                expect.unreachable('Expected requireAuthenticationWithEventAndTeam to throw 403');
            } catch (error: any) {
                expect(isHTTPAccessFallbackError(error)).toBeTruthy();
                expect(getAccessFallbackHTTPStatus(error)).toBe(403);
            }
        });

        it('throws notFound when team does not exist', async () => {
            const context = buildAuthenticationContext({
                access: {
                    grants: 'event.visible',
                    events: '*',
                    teams: '*',
                },
            });

            mockConnection.expect('selectOneRow', () => undefined);

            try {
                await requireAuthenticationWithEventAndTeam(
                    context, 'event-2026', 'non-existent-team');
                expect.unreachable('Expected notFound for missing team');
            } catch (error: any) {
                expect(isHTTPAccessFallbackError(error)).toBeTruthy();
                expect(getAccessFallbackHTTPStatus(error)).toBe(404);
            }
        });

        it('rejects users without access to the specific team', async () => {
            const context = buildAuthenticationContext({
                access: {
                    grants: [
                        { permission: 'event.visible', event: 'event-2026', team: 'other-team' },
                    ],
                },
            });

            try {
                await requireAuthenticationWithEventAndTeam(
                    context, 'event-2026', 'stewards');
                expect.unreachable('Expected 403 for unauthorised team access');
            } catch (error: any) {
                expect(isHTTPAccessFallbackError(error)).toBeTruthy();
                expect(getAccessFallbackHTTPStatus(error)).toBe(403);
            }
        });
    });
});
