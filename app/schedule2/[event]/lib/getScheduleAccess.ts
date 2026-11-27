// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';
import { cache } from 'react';
import { forbidden, notFound, unauthorized } from 'next/navigation';

import type { CachedEvent } from '@lib/cache';
import type { UserAuthenticationContext } from '@lib/auth';
import { determineAvailabilityStatus } from '@lib/EnvironmentContext';
import { getAuthenticationContext } from '@lib/auth';
import { getEvent } from '@lib/cache';
import { readUserSettings } from '@lib/UserSettings';
import db, { tEnvironmentsEvents, tEventsTeams, tTeams, tUsersEvents } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Resolved authentication, event metadata, and effective portal clock for the schedule portal.
 */
interface ScheduleAccessContext extends UserAuthenticationContext {
    currentTime: Temporal.ZonedDateTime;
    event: CachedEvent;
}

/**
 * Discriminated result returned by the request-cached schedule access resolver.
 */
type ScheduleAccessResult =
    | { context: ScheduleAccessContext; status: 'ok' }
    | { status: 'forbidden' | 'not-found' | 'unauthorized' };

/**
 * Verifies that `userId` has at least one accepted team participation in `eventId` whose portal
 * publication window is currently open.
 */
async function hasOpenPortalAvailabilityWindow(
    eventId: number,
    eventEndTime: Temporal.ZonedDateTime,
    userId: number,
    now: Temporal.ZonedDateTime): Promise<boolean>
{
    const environmentsEventsJoin = tEnvironmentsEvents.forUseInLeftJoin();

    const windows = await db.selectFrom(tUsersEvents)
        .innerJoin(tEventsTeams)
            .on(tEventsTeams.teamId.equals(tUsersEvents.teamId))
                .and(tEventsTeams.eventId.equals(tUsersEvents.eventId))
                .and(tEventsTeams.enableTeam.equals(/* true= */ 1))
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tUsersEvents.teamId))
        .leftJoin(environmentsEventsJoin)
            .on(environmentsEventsJoin.environmentId.equals(tTeams.teamEnvironmentId))
                .and(environmentsEventsJoin.eventId.equals(eventId))
        .where(tUsersEvents.userId.equals(userId))
            .and(tUsersEvents.eventId.equals(eventId))
            .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
        .select({
            start: environmentsEventsJoin.environmentPublishPortalStart,
            end: environmentsEventsJoin.environmentPublishPortalEnd,
        })
        .executeSelectMany();

    return windows.some(({ start, end }) =>
        determineAvailabilityStatus(now, eventEndTime, { start, end, override: false }) ===
        'active');
}

/**
 * Request-cached resolver shared by `getScheduleAccess()` and `requireScheduleAccess()` so layout
 * chrome and page content never duplicate auth or database lookups in the same render.
 */
const resolveScheduleAccess = cache(
    async (slug: string): Promise<ScheduleAccessResult> => {
        const authenticationContext = await getAuthenticationContext();
        if (!authenticationContext.user)
            return { status: 'unauthorized' };

        const event = await getEvent(slug);
        if (!event)
            return { status: 'not-found' };

        const { access, user } = authenticationContext;
        const wallClockNow = Temporal.Now.zonedDateTimeISO();

        if (!access.can('event.schedule.access', { event: event.slug })) {
            if (!authenticationContext.events.has(event.slug))
                return { status: 'forbidden' };

            const hasOpenWindow = await hasOpenPortalAvailabilityWindow(
                event.id, event.endTime, user.id, wallClockNow);
            if (!hasOpenWindow)
                return { status: 'forbidden' };
        }

        const timeOffsetSeconds = access.can('event.settings', { event: event.slug })
            ? (await readUserSettings(
                user.id, [ 'user-schedule-time-offset-seconds' ], /* disableFallback= */ true))
                ['user-schedule-time-offset-seconds'] ?? 0
            : 0;
        const effectiveInstant = timeOffsetSeconds
            ? wallClockNow.toInstant().add({ seconds: timeOffsetSeconds })
            : wallClockNow.toInstant();

        return {
            status: 'ok',
            context: {
                ...authenticationContext,
                currentTime: effectiveInstant.toZonedDateTimeISO(event.timeZone),
                event,
            },
        };
    });

/**
 * Non-throwing variant of `requireScheduleAccess()` for layout chrome (such as the desktop
 * sidebar) that should gracefully omit volunteer-only UI when the visitor cannot access the event.
 */
export async function getScheduleAccess(slug: string): Promise<ScheduleAccessContext | undefined> {
    const result = await resolveScheduleAccess(slug);
    return result.status === 'ok' ? result.context : undefined;
}

/**
 * Authenticates the current visitor, resolves the event by `slug`, verifies schedule portal access
 * (including availability windows), and computes the effective portal time in the event's timezone.
 *
 * Must only be invoked inside a `<Suspense>` boundary so the App Shell stays prerenderable.
 */
export async function requireScheduleAccess(slug: string): Promise<ScheduleAccessContext> {
    const result = await resolveScheduleAccess(slug);
    switch (result.status) {
        case 'ok':
            return result.context;
        case 'unauthorized':
            unauthorized();
        case 'not-found':
            notFound();
        case 'forbidden':
            forbidden();
    }
}
