// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { getAccessFallbackHTTPStatus, isHTTPAccessFallbackError }
    from 'next/dist/client/components/http-access-fallback/http-access-fallback';

import type { AuthenticationContext } from './AuthenticationContextTypes';
import type { CachedEvent, CachedTeam } from '@lib/cache';
import { AccessControl } from './access/AccessControl';
import { Cache } from '@lib/cache';
import { buildAuthenticationContext } from './AuthenticationTestHelpers';
import { requireAuthentication, requireAuthenticationWithEvent,
    requireAuthenticationWithEventAndTeam, requireVolunteerAuthentication,
    requireVolunteerAuthenticationWithEvent, requireVolunteerAuthenticationWithEventAndTeam }
    from './RequireAuthentication';
import { useMockConnection } from '@lib/database/Connection';

let mockAuthContext: AuthenticationContext | undefined;

vi.mock('./AuthenticationContext', () => ({
    requireAuthenticationContext: async () => {
        if (!mockAuthContext)
            throw new Error('Unexpected requireAuthenticationContext() call in test');
        return mockAuthContext;
    },
}));

describe('requireAuthentication', () => {
    const mockConnection = useMockConnection();

    const kTestEvent: CachedEvent = {
        id: 10,
        slug: 'event-2026',
        name: 'AnimeCon 2026',
        shortName: '2026',
        published: true,
        startTime: Temporal.ZonedDateTime.from('2026-06-05T12:00:00+02:00[Europe/Amsterdam]'),
        endTime: Temporal.ZonedDateTime.from('2026-06-07T18:00:00+02:00[Europe/Amsterdam]'),
        timeZone: 'Europe/Amsterdam',
        flags: {
            enableBuildUp: false,
            enableHotel: false,
            enableRefunds: false,
            enableTearDown: false,
            enableTraining: false,
        },
    };

    const kTestTeam: CachedTeam = {
        id: 20,
        slug: 'stewards',
        domain: 'animecon.team',
        environmentId: 1,
        name: 'Stewards',
        title: 'Stewards',
        plural: 'Stewards',
        color: '#cc0000',
        inviteKey: 'test-invite-key',
        integrations: {
            emailAccountId: 1,
        },
        flags: {
            enableDutyBook: false,
            enableScheduling: true,
            managesContent: false,
            managesFirstAid: false,
            managesKnowledgeBase: false,
            managesSecurity: false,
        },
    };

    beforeEach(() => {
        mockAuthContext = undefined;

        const eventCache = Cache.getInstance('EventCache');
        eventCache.clear();
        eventCache.set(kTestEvent.slug, kTestEvent);

        const teamCache = Cache.getInstance('TeamCache');
        teamCache.clear();
        teamCache.set(kTestTeam.slug, kTestTeam);

        Cache.getInstance('UrlSlugs').clear();
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
                await requireAuthentication(context, 'system.internals.ai');
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

        it('rejects authenticated users without admin access', async () => {
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

        it('resolves authentication context implicitly when omitted', async () => {
            mockAuthContext = buildAuthenticationContext({
                access: {
                    grants: 'event.visible,statistics.finances',
                    events: '*',
                    teams: '*',
                },
            });

            const result = await requireAuthentication('statistics.finances');
            expect(result.user).toEqual(mockAuthContext.user);
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
                        { permission: 'event.settings', event: 'other-event' },
                    ],
                },
            });

            try {
                await requireAuthenticationWithEvent(context, 'event-2026', 'event.settings');
                expect.unreachable('Expected requireAuthenticationWithEvent to throw 403');
            } catch (error: any) {
                expect(isHTTPAccessFallbackError(error)).toBeTruthy();
                expect(getAccessFallbackHTTPStatus(error)).toBe(403);
            }
        });

        it('supports EventProps params and numeric event IDs', async () => {
            mockAuthContext = buildAuthenticationContext({
                access: {
                    grants: [
                        { permission: 'event.visible', event: 'event-2026' },
                        {
                            permission: 'volunteers.participation:read',
                            event: 'event-2026',
                            team: 'stewards',
                        },
                    ],
                },
            });

            const propsResult = await requireAuthenticationWithEvent(
                { params: Promise.resolve({ event: 'event-2026', team: 'stewards' }) },
                { permission: 'volunteers.participation', operation: 'read' });
            expect(propsResult.event).toEqual(kTestEvent);

            try {
                await requireAuthenticationWithEvent(
                    { params: Promise.resolve({ event: 'event-2026', team: 'hosts' }) },
                    { permission: 'volunteers.participation', operation: 'read' });
                expect.unreachable('Expected requireAuthenticationWithEvent to throw 403');
            } catch (error: any) {
                expect(isHTTPAccessFallbackError(error)).toBeTruthy();
                expect(getAccessFallbackHTTPStatus(error)).toBe(403);
            }

            // Direct slug without explicit context:
            const slugResult = await requireAuthenticationWithEvent('event-2026');
            expect(slugResult.event).toEqual(kTestEvent);

            // Numeric event ID resolved via UrlSlugs:
            mockConnection.expect('selectOneColumnOneRow', () => kTestEvent.slug);
            const numericResult = await requireAuthenticationWithEvent(
                mockAuthContext, kTestEvent.id);
            expect(numericResult.event).toEqual(kTestEvent);
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
                            permission: 'volunteers.participation:read',
                            event: 'event-2026',
                            team: 'stewards',
                        },
                    ],
                },
            });

            const result = await requireAuthenticationWithEventAndTeam(
                context, 'event-2026', 'stewards', {
                    permission: 'volunteers.participation',
                    operation: 'read',
                });
            expect(result.team).toEqual(kTestTeam);

            try {
                await requireAuthenticationWithEventAndTeam(
                    context, 'event-2026', 'stewards', {
                        permission: 'volunteers.participation',
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
                        {
                            permission: 'volunteers.participation:read',
                            event: 'event-2026',
                            team: 'other-team',
                        },
                    ],
                },
            });

            try {
                await requireAuthenticationWithEventAndTeam(
                    context, 'event-2026', 'stewards', {
                        permission: 'volunteers.participation',
                        operation: 'read',
                    });
                expect.unreachable('Expected 403 for unauthorised team access');
            } catch (error: any) {
                expect(isHTTPAccessFallbackError(error)).toBeTruthy();
                expect(getAccessFallbackHTTPStatus(error)).toBe(403);
            }
        });

        it('supports EventAndTeamProps params, omitted context, and numeric IDs', async () => {
            mockAuthContext = buildAuthenticationContext({
                access: {
                    grants: [
                        { permission: 'event.visible', event: 'event-2026', team: 'stewards' },
                        {
                            permission: 'volunteers.participation:read',
                            event: 'event-2026',
                            team: 'stewards',
                        },
                    ],
                },
            });

            const propsResult = await requireAuthenticationWithEventAndTeam(
                { params: Promise.resolve({ event: 'event-2026', team: 'stewards' }) },
                { permission: 'volunteers.participation', operation: 'read' });
            expect(propsResult.event).toEqual(kTestEvent);
            expect(propsResult.team).toEqual(kTestTeam);

            // Direct event & team identifiers without explicit context:
            const directResult = await requireAuthenticationWithEventAndTeam(
                'event-2026', 'stewards');
            expect(directResult.event).toEqual(kTestEvent);
            expect(directResult.team).toEqual(kTestTeam);

            // Numeric event & team IDs resolved via UrlSlugs:
            mockConnection.expect('selectOneColumnOneRow', () => kTestTeam.slug);
            mockConnection.expect('selectOneColumnOneRow', () => kTestEvent.slug);
            const numericResult = await requireAuthenticationWithEventAndTeam(
                mockAuthContext, kTestEvent.id, kTestTeam.id);
            expect(numericResult.event).toEqual(kTestEvent);
            expect(numericResult.team).toEqual(kTestTeam);
        });
    });

    describe('requireVolunteerAuthentication', () => {
        it('allows access for regular volunteers with accepted registrations', async () => {
            const context = buildAuthenticationContext({
                events: new Map([ [ 'event-2026', 'stewards' ] ]),
            });

            const result = await requireVolunteerAuthentication(context);
            expect(result.user).toEqual(context.user);
            expect(result.events.size).toBe(1);
        });

        it('allows access for administrators even without event registrations', async () => {
            const context = buildAuthenticationContext({
                access: {
                    grants: 'event.visible',
                    events: '*',
                    teams: '*',
                },
                events: new Map(),
            });

            const result = await requireVolunteerAuthentication(context);
            expect(result.user).toEqual(context.user);
        });

        it('verifies additional permissions when provided', async () => {
            const context = buildAuthenticationContext({
                access: {
                    grants: 'test.boolean',
                },
                events: new Map([ [ 'event-2026', 'stewards' ] ]),
            });

            const result = await requireVolunteerAuthentication(context, 'test.boolean');
            expect(result.user).toEqual(context.user);

            try {
                await requireVolunteerAuthentication(context, 'system.internals.ai');
                expect.unreachable('Expected requireVolunteerAuthentication to throw 403');
            } catch (error: any) {
                expect(isHTTPAccessFallbackError(error)).toBeTruthy();
                expect(getAccessFallbackHTTPStatus(error)).toBe(403);
            }
        });

        it('rejects visitors without a logged-in user', async () => {
            const visitorContext = { access: new AccessControl({}), user: undefined };
            try {
                await requireVolunteerAuthentication(visitorContext);
                expect.unreachable('Expected requireVolunteerAuthentication to throw 401');
            } catch (error: any) {
                expect(isHTTPAccessFallbackError(error)).toBeTruthy();
                expect(getAccessFallbackHTTPStatus(error)).toBe(401);
            }
        });

        it('allows access for users with event.schedule.access without event.visible', async () => {
            const context = buildAuthenticationContext({
                access: {
                    grants: [
                        { permission: 'event.schedule.access', event: 'event-2026' },
                    ],
                },
                events: new Map(),
            });

            const result = await requireVolunteerAuthentication(context);
            expect(result.user).toEqual(context.user);
        });

        it('rejects authenticated users without volunteer or admin access', async () => {
            const context = buildAuthenticationContext({
                events: new Map(),
            });

            try {
                await requireVolunteerAuthentication(context);
                expect.unreachable('Expected requireVolunteerAuthentication to throw 403');
            } catch (error: any) {
                expect(isHTTPAccessFallbackError(error)).toBeTruthy();
                expect(getAccessFallbackHTTPStatus(error)).toBe(403);
            }
        });
    });

    describe('requireVolunteerAuthenticationWithEvent', () => {
        it('allows access for volunteers registered for the specific event', async () => {
            const context = buildAuthenticationContext({
                events: new Map([ [ 'event-2026', 'stewards' ] ]),
            });

            const result = await requireVolunteerAuthenticationWithEvent(context, 'event-2026');
            expect(result.user).toEqual(context.user);
            expect(result.event).toEqual(kTestEvent);
        });

        it('allows access for event administrators', async () => {
            const context = buildAuthenticationContext({
                access: {
                    grants: [
                        { permission: 'event.visible', event: 'event-2026' },
                    ],
                },
                events: new Map(),
            });

            const result = await requireVolunteerAuthenticationWithEvent(context, 'event-2026');
            expect(result.user).toEqual(context.user);
            expect(result.event).toEqual(kTestEvent);
        });

        it('allows access for users with event.schedule.access for the specific event', async () => {
            const context = buildAuthenticationContext({
                access: {
                    grants: [
                        { permission: 'event.schedule.access', event: 'event-2026' },
                    ],
                },
                events: new Map(),
            });

            const result = await requireVolunteerAuthenticationWithEvent(context, 'event-2026');
            expect(result.user).toEqual(context.user);
            expect(result.event).toEqual(kTestEvent);

            const otherEventContext = buildAuthenticationContext({
                access: {
                    grants: [
                        { permission: 'event.schedule.access', event: 'other-event' },
                    ],
                },
                events: new Map(),
            });

            try {
                await requireVolunteerAuthenticationWithEvent(otherEventContext, 'event-2026');
                expect.unreachable('Expected requireVolunteerAuthenticationWithEvent to throw 403');
            } catch (error: any) {
                expect(isHTTPAccessFallbackError(error)).toBeTruthy();
                expect(getAccessFallbackHTTPStatus(error)).toBe(403);
            }
        });

        it('verifies event-level permissions when provided', async () => {
            const context = buildAuthenticationContext({
                access: {
                    grants: [
                        { permission: 'event.schedule.access', event: 'event-2026' },
                    ],
                },
                events: new Map([ [ 'event-2026', 'stewards' ] ]),
            });

            const result = await requireVolunteerAuthenticationWithEvent(
                context, 'event-2026', 'event.schedule.access');
            expect(result.event).toEqual(kTestEvent);

            try {
                await requireVolunteerAuthenticationWithEvent(
                    context, 'event-2026', 'statistics.finances');
                expect.unreachable('Expected requireVolunteerAuthenticationWithEvent to throw 403');
            } catch (error: any) {
                expect(isHTTPAccessFallbackError(error)).toBeTruthy();
                expect(getAccessFallbackHTTPStatus(error)).toBe(403);
            }
        });

        it('throws notFound for non-existent events', async () => {
            const context = buildAuthenticationContext({
                events: new Map([ [ 'event-2026', 'stewards' ] ]),
            });

            mockConnection.expect('selectOneRow', () => undefined);

            try {
                await requireVolunteerAuthenticationWithEvent(context, 'non-existent-event');
                expect.unreachable(
                    'Expected requireVolunteerAuthenticationWithEvent to throw notFound');
            } catch (error: any) {
                expect(isHTTPAccessFallbackError(error)).toBeTruthy();
                expect(getAccessFallbackHTTPStatus(error)).toBe(404);
            }
        });

        it('rejects volunteers who are not registered for the specific event', async () => {
            const context = buildAuthenticationContext({
                events: new Map([ [ 'other-event', 'stewards' ] ]),
            });

            try {
                await requireVolunteerAuthenticationWithEvent(context, 'event-2026');
                expect.unreachable('Expected requireVolunteerAuthenticationWithEvent to throw 403');
            } catch (error: any) {
                expect(isHTTPAccessFallbackError(error)).toBeTruthy();
                expect(getAccessFallbackHTTPStatus(error)).toBe(403);
            }
        });
    });

    describe('requireVolunteerAuthenticationWithEventAndTeam', () => {
        it('allows access for volunteers registered for the specific event and team', async () => {
            const context = buildAuthenticationContext({
                events: new Map([ [ 'event-2026', 'stewards' ] ]),
            });

            const result = await requireVolunteerAuthenticationWithEventAndTeam(
                context, 'event-2026', 'stewards');
            expect(result.user).toEqual(context.user);
            expect(result.event).toEqual(kTestEvent);
            expect(result.team).toEqual(kTestTeam);
        });

        it('allows access for team administrators', async () => {
            const context = buildAuthenticationContext({
                access: {
                    grants: [
                        { permission: 'event.visible', event: 'event-2026', team: 'stewards' },
                    ],
                },
                events: new Map(),
            });

            const result = await requireVolunteerAuthenticationWithEventAndTeam(
                context, 'event-2026', 'stewards');
            expect(result.user).toEqual(context.user);
            expect(result.event).toEqual(kTestEvent);
            expect(result.team).toEqual(kTestTeam);
        });

        it('verifies team-level permissions when provided', async () => {
            const context = buildAuthenticationContext({
                access: {
                    grants: [
                        {
                            permission: 'volunteers.participation:read',
                            event: 'event-2026',
                            team: 'stewards',
                        },
                    ],
                },
                events: new Map([ [ 'event-2026', 'stewards' ] ]),
            });

            const result = await requireVolunteerAuthenticationWithEventAndTeam(
                context, 'event-2026', 'stewards', {
                    permission: 'volunteers.participation',
                    operation: 'read',
                });
            expect(result.team).toEqual(kTestTeam);

            try {
                await requireVolunteerAuthenticationWithEventAndTeam(
                    context, 'event-2026', 'stewards', {
                        permission: 'volunteers.participation',
                        operation: 'update',
                    });
                expect.unreachable(
                    'Expected requireVolunteerAuthenticationWithEventAndTeam to throw 403');
            } catch (error: any) {
                expect(isHTTPAccessFallbackError(error)).toBeTruthy();
                expect(getAccessFallbackHTTPStatus(error)).toBe(403);
            }
        });

        it('throws notFound when team does not exist', async () => {
            const context = buildAuthenticationContext({
                events: new Map([ [ 'event-2026', 'stewards' ] ]),
            });

            mockConnection.expect('selectOneRow', () => undefined);

            try {
                await requireVolunteerAuthenticationWithEventAndTeam(
                    context, 'event-2026', 'non-existent-team');
                expect.unreachable('Expected notFound for missing team');
            } catch (error: any) {
                expect(isHTTPAccessFallbackError(error)).toBeTruthy();
                expect(getAccessFallbackHTTPStatus(error)).toBe(404);
            }
        });

        it('rejects volunteers registered for a different team', async () => {
            const context = buildAuthenticationContext({
                events: new Map([ [ 'event-2026', 'hosts' ] ]),
            });

            try {
                await requireVolunteerAuthenticationWithEventAndTeam(
                    context, 'event-2026', 'stewards');
                expect.unreachable('Expected 403 for wrong team');
            } catch (error: any) {
                expect(isHTTPAccessFallbackError(error)).toBeTruthy();
                expect(getAccessFallbackHTTPStatus(error)).toBe(403);
            }
        });
        it('rejects users with only event.schedule.access when team is required', async () => {
            const context = buildAuthenticationContext({
                access: {
                    grants: [
                        { permission: 'event.schedule.access', event: 'event-2026' },
                    ],
                },
                events: new Map(),
            });

            try {
                await requireVolunteerAuthenticationWithEventAndTeam(
                    context, 'event-2026', 'stewards');
                expect.unreachable('Expected 403 for event.schedule.access without team access');
            } catch (error: any) {
                expect(isHTTPAccessFallbackError(error)).toBeTruthy();
                expect(getAccessFallbackHTTPStatus(error)).toBe(403);
            }
        });
    });
});
