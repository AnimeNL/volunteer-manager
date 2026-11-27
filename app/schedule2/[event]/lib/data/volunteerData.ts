// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';
import { cache } from 'react';

import type { AccessControl } from '@lib/auth/access';
import type { CachedEvent } from '@lib/cache';
import type { EventState, EventTeam, VolunteerStateAtTime } from '@lib/event';
import { VolunteerAccess } from '../access/VolunteerAccess';
import { formatDate } from '@lib/Temporal';
import { getEventState } from '@lib/event';

/**
 * Individual volunteer entry displayed in a team roster.
 */
export interface VolunteerSummary {
    /**
     * Name of the shift the volunteer is currently performing, if any.
     */
    activeShift?: string;

    /**
     * Optional avatar image URL.
     */
    avatar?: string;

    /**
     * Unique volunteer user ID used for `/volunteers/[id]` links.
     */
    id: number;

    /**
     * Whether the volunteer's active shift is a Backup shift (available to help).
     */
    isBackup?: boolean;

    /**
     * Full display name of the volunteer.
     */
    name: string;

    /**
     * Assigned role name (e.g. "Steward", "Senior Steward", "Staff").
     */
    role: string;

    /**
     * Whether the assigned role represents team leadership or senior staff.
     */
    roleLeader?: boolean;

    /**
     * Formatted local return time (`HH:mm` or `ddd HH:mm`), or `'indefinite'` when the volunteer is
     * not expected to return during the event. Omitted when the volunteer is available.
     */
    unavailableUntil?: string;
}

/**
 * Team summary displayed on the `/volunteers` hub page.
 */
export interface VolunteerTeamSummary {
    /**
     * Number of volunteers currently on shift (including Backup shifts).
     */
    activeCount: number;

    /**
     * First names of volunteers currently on shift, ordered alphabetically.
     */
    activeFirstNames: string[];

    /**
     * Team accent colour.
     */
    colour: string;

    /**
     * Whether the signed-in volunteer belongs to this team.
     */
    isUserTeam: boolean;

    /**
     * Display name of the team.
     */
    name: string;

    /**
     * URL slug identifying the team in `/volunteers/teams/[team]`.
     */
    slug: string;

    /**
     * Total number of volunteers assigned to this team.
     */
    totalCount: number;
}

/**
 * Full team detail including its roster of volunteers.
 */
interface VolunteerTeamDetail extends VolunteerTeamSummary {
    volunteers: VolunteerSummary[];
}

/**
 * Viewer and event context required to evaluate team and volunteer visibility.
 */
interface VolunteerViewerContext {
    access: AccessControl;
    currentTime: Temporal.ZonedDateTime;
    event: CachedEvent;
    user: { id: number };
}

/**
 * Request-cached builder creating a `VolunteerAccess` policy instance from `EventState` without
 * issuing additional database queries.
 */
const resolveVolunteerContext = cache(
    async (
        event: CachedEvent,
        viewerUserId: number,
        access: AccessControl): Promise<{
            eventState: EventState;
            volunteerAccess: VolunteerAccess;
        } | undefined> =>
    {
        const eventState = await getEventState(event);
        if (!eventState)
            return undefined;

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

        const volunteerAccess = new VolunteerAccess({
            viewerUserId,
            eventSlug: event.slug,
            access,
            teams,
            teamVisibility: eventState.volunteers.getTeamVisibility(),
            participations,
            shifts,
        });

        return { eventState, volunteerAccess };
    });

/**
 * Formats an unavailability return timestamp relative to `currentTime` in `timeZone`.
 */
function formatUnavailableUntil(
    availableAgainAtMs: number | undefined,
    currentTime: Temporal.ZonedDateTime,
    timeZone: string): string
{
    if (availableAgainAtMs === undefined)
        return 'indefinite';

    const returnTime = Temporal.Instant.fromEpochMilliseconds(availableAgainAtMs)
        .toZonedDateTimeISO(timeZone);

    const sameDay = returnTime.year === currentTime.year &&
        returnTime.month === currentTime.month &&
        returnTime.day === currentTime.day;

    return formatDate(returnTime, sameDay ? 'HH:mm' : 'ddd HH:mm');
}

/**
 * Projects a volunteer's live state into a `VolunteerSummary` row for `team`, respecting
 * `volunteerAccess.canSeeShift()` for multi-team shift isolation.
 */
function buildVolunteerSummary(
    eventState: EventState,
    volunteerAccess: VolunteerAccess,
    team: EventTeam,
    volunteerState: VolunteerStateAtTime,
    currentTime: Temporal.ZonedDateTime): VolunteerSummary
{
    const { volunteer } = volunteerState;
    const role = eventState.volunteers.getVolunteerRole(volunteer.id, team.id);

    const visibleActiveAssignments = volunteerState.activeAssignments.filter(
        assignment => volunteerAccess.canSeeShift(assignment.id));

    let activeShift: string | undefined;
    let isBackup: boolean | undefined;

    if (visibleActiveAssignments.length > 0) {
        const primaryShift = eventState.shifts.getShift(visibleActiveAssignments[0].shiftId);
        activeShift = primaryShift?.name;
        if (visibleActiveAssignments.some(
            assignment => eventState.shifts.getShift(assignment.shiftId)?.isBackup))
        {
            isBackup = true;
        }
    }

    let unavailableUntil: string | undefined;
    if (!activeShift && volunteerState.status === 'unavailable') {
        unavailableUntil = formatUnavailableUntil(
            volunteerState.availableAgainAtMs, currentTime, eventState.timeZone);
    }

    return {
        activeShift,
        avatar: volunteer.avatar,
        id: volunteer.id,
        isBackup,
        name: volunteer.name,
        role: role?.name ?? team.title,
        roleLeader: role?.isLeader ? true : undefined,
        unavailableUntil,
    };
}

/**
 * Builds a `VolunteerTeamDetail` for `team` at `currentTime`.
 */
function buildTeamDetail(
    eventState: EventState,
    volunteerAccess: VolunteerAccess,
    team: EventTeam,
    currentTime: Temporal.ZonedDateTime): VolunteerTeamDetail
{
    const snapshot = eventState.at(currentTime);
    const states = snapshot.volunteers({ teamId: team.id });

    const volunteers = states
        .map(volunteerState =>
            buildVolunteerSummary(eventState, volunteerAccess, team, volunteerState, currentTime))
        .sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));

    const activeFirstNames: string[] = [];
    for (const volunteerState of states) {
        const hasVisibleActiveShift = volunteerState.activeAssignments.some(
            assignment => volunteerAccess.canSeeShift(assignment.id));
        if (hasVisibleActiveShift)
            activeFirstNames.push(volunteerState.volunteer.firstName);
    }

    activeFirstNames.sort((lhs, rhs) => lhs.localeCompare(rhs));

    return {
        activeCount: activeFirstNames.length,
        activeFirstNames,
        colour: team.colourLight,
        isUserTeam: volunteerAccess.isMemberTeam(team.id),
        name: team.name,
        slug: team.slug,
        totalCount: volunteers.length,
        volunteers,
    };
}

/**
 * Returns visible volunteer team summaries for the signed-in viewer, ordered alphabetically by
 * team name. Excludes teams with no accepted volunteers.
 */
export async function getVolunteerTeams(
    context: VolunteerViewerContext): Promise<VolunteerTeamSummary[]>
{
    const resolved = await resolveVolunteerContext(
        context.event, context.user.id, context.access);
    if (!resolved)
        return [];

    const { eventState, volunteerAccess } = resolved;
    const summaries: VolunteerTeamSummary[] = [];

    for (const team of eventState.volunteers.getTeams()) {
        if (!volunteerAccess.canSeeTeam(team.id))
            continue;

        const detail = buildTeamDetail(eventState, volunteerAccess, team, context.currentTime);
        if (detail.totalCount === 0)
            continue;

        summaries.push({
            activeCount: detail.activeCount,
            activeFirstNames: detail.activeFirstNames,
            colour: detail.colour,
            isUserTeam: detail.isUserTeam,
            name: detail.name,
            slug: detail.slug,
            totalCount: detail.totalCount,
        });
    }

    return summaries;
}

/**
 * Returns volunteer team detail and live roster for `teamSlug` if the team exists and is visible
 * to the signed-in viewer, or `undefined` otherwise.
 */
export async function getVolunteerTeamDetail(
    context: VolunteerViewerContext,
    teamSlug: string): Promise<VolunteerTeamDetail | undefined>
{
    const resolved = await resolveVolunteerContext(
        context.event, context.user.id, context.access);
    if (!resolved)
        return undefined;

    const { eventState, volunteerAccess } = resolved;
    const team = eventState.volunteers.getTeam(teamSlug);
    if (!team || !volunteerAccess.canSeeTeam(team.id))
        return undefined;

    return buildTeamDetail(eventState, volunteerAccess, team, context.currentTime);
}
