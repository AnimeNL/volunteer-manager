// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';
import { cache } from 'react';

import type { AccessControl } from '@lib/auth/access';
import type { CachedEvent } from '@lib/cache';
import type { EventState } from '@lib/event';
import type { User } from '@lib/auth';
import { VolunteerAccess } from './VolunteerAccess';
import { getEventState } from '@lib/event';
import { requireScheduleAccess } from '../getScheduleAccess';

/**
 * Minimal viewer and event context accepted by `getVolunteerAccess()`. Compatible with both
 * `requireScheduleAccess()` (Server Components) and `requireVolunteerAuthenticationWithEvent()`
 * (Server Actions).
 */
export interface VolunteerAccessContext {
    access: AccessControl;
    event: CachedEvent;
    user: Pick<User, 'id'>;
}

/**
 * Builds a `VolunteerAccess` policy instance directly from an in-memory `EventState` snapshot,
 * issuing no database queries.
 */
function buildVolunteerAccess(
    eventState: EventState,
    viewerUserId: number,
    access: AccessControl): VolunteerAccess
{
    const teams = eventState.volunteers.getTeams().map(team => ({
        id: team.id,
        slug: team.slug,
    }));

    const participations: { userId: number; teamId: number; isLeader: boolean }[] = [];
    for (const volunteer of eventState.volunteers.getVolunteers()) {
        for (const participation of volunteer.participations) {
            const role = eventState.volunteers.getRole(participation.roleId);
            participations.push({
                userId: volunteer.id,
                teamId: participation.teamId,
                isLeader: role?.isLeader ?? false,
            });
        }
    }

    const shifts = eventState.shifts.getAllAssignments().map(assignment => ({
        scheduleId: assignment.id,
        userId: assignment.userId,
        shiftId: assignment.shiftId,
        shiftTeamId: assignment.teamId,
        activityId: assignment.activityId,
        startMs: assignment.startMs,
        endMs: assignment.endMs,
    }));

    return new VolunteerAccess({
        viewerUserId,
        eventSlug: eventState.eventSlug,
        access,
        teams,
        teamVisibility: eventState.volunteers.getTeamVisibility(),
        participations,
        shifts,
    });
}

/**
 * Request-cached builder so multiple Server Components and data loaders in the same render share
 * one precomputed `VolunteerAccess` instance backed by the permanent `EventState` cache.
 */
const resolveVolunteerAccess = cache(
    async (
        event: CachedEvent,
        viewerUserId: number,
        access: AccessControl): Promise<VolunteerAccess> =>
    {
        const eventState = await getEventState(event);
        if (!eventState) {
            return new VolunteerAccess({
                viewerUserId,
                eventSlug: event.slug,
                access,
                teams: [],
                teamVisibility: new Map(),
                participations: [],
                shifts: [],
            });
        }

        return buildVolunteerAccess(eventState, viewerUserId, access);
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

    return await resolveVolunteerAccess(context.event, context.user.id, context.access);
}
