// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';
import { cache } from 'react';
import { forbidden, notFound } from 'next/navigation';

import type { CachedEvent } from '@lib/cache';
import type { UserAuthenticationContext } from '@lib/auth';
import { getEvent } from '@lib/cache';
import { isAfter } from '@lib/Temporal';
import { readSetting } from '@lib/Settings';
import { requireAuthenticationContext } from '@lib/auth';
import db, { tEnvironmentsEvents, tEventsTeams, tTeams, tUsersEvents } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Resolved authentication, event metadata, and effective portal clock for `app/schedule2/[slug]/`.
 */
interface ScheduleAccessContext extends UserAuthenticationContext {
    currentTime: Temporal.ZonedDateTime;
    event: CachedEvent;
}

/**
 * Verifies that `userId` has at least one accepted team participation in `eventId` whose portal
 * publication window is currently open.
 */
async function hasOpenPortalAvailabilityWindow(
    eventId: number, userId: number, now: Temporal.ZonedDateTime): Promise<boolean>
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

    for (const { start, end } of windows) {
        if (!start || isAfter(start, now))
            continue;

        if (!end || isAfter(end, now))
            return true;
    }

    return false;
}

/**
 * Authenticates the current visitor, resolves the event by `slug`, verifies schedule portal access
 * (including availability windows), and computes the effective portal time in the event's timezone.
 *
 * Must only be invoked inside a `<Suspense>` boundary so the App Shell stays prerenderable.
 */
export const requireScheduleAccess = cache(
    async (slug: string): Promise<ScheduleAccessContext> => {
        const authenticationContext = await requireAuthenticationContext();
        const { access, user } = authenticationContext;

        const event = await getEvent(slug);
        if (!event)
            notFound();

        const wallClockNow = Temporal.Now.zonedDateTimeISO();

        if (!access.can('event.schedule.access', { event: event.slug })) {
            if (!authenticationContext.events.has(event.slug))
                forbidden();

            const hasOpenWindow =
                await hasOpenPortalAvailabilityWindow(event.id, user.id, wallClockNow);
            if (!hasOpenWindow)
                forbidden();
        }

        const timeOffsetSeconds = await readSetting('schedule-time-offset-seconds') ?? 0;
        const effectiveInstant = timeOffsetSeconds
            ? wallClockNow.toInstant().add({ seconds: timeOffsetSeconds })
            : wallClockNow.toInstant();

        return {
            ...authenticationContext,
            currentTime: effectiveInstant.toZonedDateTimeISO(event.timeZone),
            event,
        };
    });
