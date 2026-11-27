// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';
import { cache } from 'react';
import { cacheLife, cacheTag } from 'next/cache';

import type { AccessControl } from '@lib/auth/access';
import type { CachedEvent } from '@lib/cache';
import type { User } from '@lib/auth';
import type { VolunteerAccessParams } from './VolunteerAccess';
import { VolunteerAccess } from './VolunteerAccess';
import { requireScheduleAccess } from '../getScheduleAccess';
import db, { tEventsTeams, tRoles, tSchedule, tShifts, tTeams, tTeamsVisibility, tUsersEvents }
    from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Minimal viewer and event context accepted by `getVolunteerAccess()`. Compatible with both
 * `requireScheduleAccess()` (Server Components) and `requireVolunteerAuthenticationWithEvent()`
 * (Server Actions).
 */
export interface VolunteerAccessContext {
    access: AccessControl;
    event: Pick<CachedEvent, 'id' | 'slug'>;
    user: Pick<User, 'id'>;
}

/**
 * Serializable event-wide snapshot cached across requests for constructing `VolunteerAccess`.
 */
interface CachedEventAccessSnapshot {
    teams: VolunteerAccessParams['teams'];
    participations: VolunteerAccessParams['participations'];
    shifts: VolunteerAccessParams['shifts'];
}

/**
 * Loads all directional team visibility edges (`[teamId, visibleTeamId]`) behind `'use cache'`.
 * Invalidated via `updateTag('schedule-teams-visibility')` when team settings change.
 */
async function loadCachedTeamVisibility(): Promise<readonly [ number, number ][]> {
    'use cache';
    cacheLife('minutes');
    cacheTag('schedule-teams-visibility');

    const rows = await db.selectFrom(tTeamsVisibility)
        .select({
            teamId: tTeamsVisibility.teamId,
            visibleTeamId: tTeamsVisibility.visibleTeamId,
        })
        .executeSelectMany();

    return rows.map(row => [ row.teamId, row.visibleTeamId ]);
}

/**
 * Loads the permission-neutral event snapshot (enabled teams, accepted participations, and active
 * scheduled shift windows) required by `VolunteerAccess`, cached per event.
 */
async function loadCachedEventAccessSnapshot(eventId: number): Promise<CachedEventAccessSnapshot> {
    'use cache';
    cacheLife('minutes');
    cacheTag('schedule-volunteer-access', `schedule-volunteer-access:${eventId}`);

    const [ teams, participations, rawShifts ] = await Promise.all([
        db.selectFrom(tEventsTeams)
            .innerJoin(tTeams)
                .on(tTeams.teamId.equals(tEventsTeams.teamId))
                    .and(tTeams.teamDeleted.isNull())
            .where(tEventsTeams.eventId.equals(eventId))
                .and(tEventsTeams.enableTeam.equals(/* true= */ 1))
            .select({
                id: tTeams.teamId,
                slug: tTeams.teamSlug,
            })
            .executeSelectMany(),

        db.selectFrom(tUsersEvents)
            .innerJoin(tRoles)
                .on(tRoles.roleId.equals(tUsersEvents.roleId))
            .where(tUsersEvents.eventId.equals(eventId))
                .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
            .select({
                userId: tUsersEvents.userId,
                teamId: tUsersEvents.teamId,
                isLeader: tRoles.rolePermissionGrant.isNotNull(),
            })
            .executeSelectMany(),

        db.selectFrom(tSchedule)
            .innerJoin(tShifts)
                .on(tShifts.shiftId.equals(tSchedule.shiftId))
                    .and(tShifts.shiftDeleted.isNull())
            .where(tSchedule.eventId.equals(eventId))
                .and(tSchedule.scheduleDeleted.isNull())
            .select({
                scheduleId: tSchedule.scheduleId,
                userId: tSchedule.userId,
                shiftId: tShifts.shiftId,
                shiftTeamId: tShifts.teamId,
                activityId: tShifts.shiftActivityId,
                start: tSchedule.scheduleTimeStart,
                end: tSchedule.scheduleTimeEnd,
            })
            .executeSelectMany(),
    ]);

    const shifts = rawShifts.map(shift => ({
        scheduleId: shift.scheduleId,
        userId: shift.userId,
        shiftId: shift.shiftId,
        shiftTeamId: shift.shiftTeamId,
        activityId: shift.activityId,
        startMs: shift.start.epochMilliseconds,
        endMs: shift.end.epochMilliseconds,
    }));

    return { teams, participations, shifts };
}

/**
 * Converts flat `[teamId, visibleTeamId]` edges into a lookup map for `VolunteerAccess`.
 */
function buildTeamVisibilityMap(
    edges: readonly [ number, number ][]): Map<number, Set<number>>
{
    const map = new Map<number, Set<number>>();
    for (const [ teamId, visibleTeamId ] of edges) {
        let targets = map.get(teamId);
        if (!targets) {
            targets = new Set<number>();
            map.set(teamId, targets);
        }

        targets.add(visibleTeamId);
    }

    return map;
}

/**
 * Request-cached builder so multiple Server Components and data loaders in the same render share
 * one precomputed `VolunteerAccess` instance.
 */
const resolveVolunteerAccess = cache(
    async (
        eventId: number,
        eventSlug: string,
        viewerUserId: number,
        access: AccessControl): Promise<VolunteerAccess> =>
    {
        const [ visibilityEdges, snapshot ] = await Promise.all([
            loadCachedTeamVisibility(),
            loadCachedEventAccessSnapshot(eventId),
        ]);

        return new VolunteerAccess({
            viewerUserId,
            eventSlug,
            access,
            teams: snapshot.teams,
            teamVisibility: buildTeamVisibilityMap(visibilityEdges),
            participations: snapshot.participations,
            shifts: snapshot.shifts,
        });
    });

/**
 * Resolves the `VolunteerAccess` deciding unit for the signed-in user in the given event. Accepts
 * either an already-authenticated context (from `requireScheduleAccess()` or a Server Action) or
 * an event slug (which authenticates via `requireScheduleAccess()`).
 */
export async function getVolunteerAccess(
    contextOrEventSlug: VolunteerAccessContext | string): Promise<VolunteerAccess>
{
    const context = typeof contextOrEventSlug === 'string'
        ? await requireScheduleAccess(contextOrEventSlug)
        : contextOrEventSlug;

    return await resolveVolunteerAccess(
        context.event.id, context.event.slug, context.user.id, context.access);
}
