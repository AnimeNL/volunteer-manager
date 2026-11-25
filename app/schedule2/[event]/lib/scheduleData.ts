// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';
import { cache } from 'react';
import { cacheLife, cacheTag } from 'next/cache';

import type { NavigationData } from './navigationTypes';
import { getScheduleAccess } from './getScheduleAccess';
import db, { tActivities, tActivitiesAreas, tActivitiesLocations, tActivitiesTimeslots, tContent,
    tContentCategories, tDisplaysRequests, tDutyBook, tDutyBookViewers, tEventsTeams, tSchedule,
    tShifts, tTeams, tUsersEvents } from '@lib/database';

import { kActivityType, kRegistrationStatus } from '@lib/database/Types';

/**
 * Serializable time range returned from cached shift and program loaders.
 */
interface TimeWindow {
    endEpochMs: number;
    startEpochMs: number;
}

/**
 * Serializable program area record returned from the cached program loader.
 */
interface ProgramAreaRecord {
    id: number;
    name: string;
    timeslots: TimeWindow[];
}

/**
 * Serializable Duty Book-enabled team record cached per event.
 */
interface DutyBookTeamRecord {
    id: number;
    name: string;
    slug: string;
}

/**
 * Serializable Knowledge Base category visibility constraints cached per event.
 */
interface KnowledgeCategoryRecord {
    id: number;
    roles: string;
    teams: string;
}

/**
 * Request-cached loader computing all navigation state for `eventSlug`. Shared across both desktop
 * and mobile menus so layout chrome never duplicates queries in the same render.
 */
export const getNavigationData = cache(
    async (eventSlug: string): Promise<NavigationData | undefined> => {
        const access = await getScheduleAccess(eventSlug);
        if (!access)
            return undefined;

        const { access: permissions, currentTime, event, events, user } = access;
        const festivalId = event.integrations?.anPlanFestivalId;
        const memberTeams = events.get(event.slug);

        const [ shiftWindows, programAreas, dutyBookTeams, knowledgeCategories ] =
            await Promise.all([
                getUserEventShiftWindows(event.id, user.id),
                festivalId ? getProgramAreas(festivalId) : Promise.resolve([]),
                getEventDutyBookTeams(event.id),
                getEventKnowledgeCategories(event.id),
            ]);

        const accessibleDutyBooks = dutyBookTeams.filter(team =>
            memberTeams?.has(team.slug) ||
            permissions.can('event.duty-book', 'read', { event: event.slug, team: team.slug }));

        const canViewHelpRequests = permissions.can('event.help-requests', { event: event.slug });
        const hasSettings = permissions.can('event.settings', { event: event.slug });
        const hasUnrestrictedKnowledge = permissions.can('event.knowledge', { event: event.slug });

        const [ unreadByTeam, pendingHelpRequests, hasKnowledgeBase ] = await Promise.all([
            getUnreadDutyBookCounts(event.id, user.id, accessibleDutyBooks.map(t => t.id)),
            canViewHelpRequests ? getPendingHelpRequestCount(event.id) : Promise.resolve(undefined),
            resolveKnowledgeBaseVisibility(
                knowledgeCategories, event.id, user.id, hasUnrestrictedKnowledge, memberTeams),
        ]);

        const currentMs = currentTime.epochMilliseconds;
        const isActive = (window: TimeWindow) =>
            window.startEpochMs <= currentMs && window.endEpochMs > currentMs;

        const areas = programAreas.map(area => ({
            activeCount: area.timeslots.filter(isActive).length,
            id: area.id,
            name: area.name,
        }));

        const dutyBooks = accessibleDutyBooks.map(team => ({
            name: team.name,
            team: team.slug,
            unread: unreadByTeam.get(team.id) ?? 0,
        }));

        return {
            areas,
            dutyBooks,
            eventSlug: event.slug,
            hasActiveShift: shiftWindows.some(isActive),
            hasKnowledgeBase,
            hasSettings,
            hasShifts: shiftWindows.length > 0,
            helpRequests: pendingHelpRequests !== undefined
                ? { pending: pendingHelpRequests }
                : undefined,
        };
    });

/**
 * Loads scheduled shift start/end windows for `userId` in `eventId`. Timestamps are returned as
 * epoch milliseconds so the result serializes cleanly across `'use cache'` boundaries.
 */
async function getUserEventShiftWindows(eventId: number, userId: number): Promise<TimeWindow[]> {
    'use cache';
    cacheLife('minutes');
    cacheTag('schedule2-shifts', `schedule2-shifts:${eventId}:${userId}`);

    const rows = await db.selectFrom(tSchedule)
        .innerJoin(tShifts)
            .on(tShifts.shiftId.equals(tSchedule.shiftId))
                .and(tShifts.shiftDeleted.isNull())
        .where(tSchedule.eventId.equals(eventId))
            .and(tSchedule.userId.equals(userId))
            .and(tSchedule.scheduleDeleted.isNull())
        .select({
            start: tSchedule.scheduleTimeStart,
            end: tSchedule.scheduleTimeEnd,
        })
        .executeSelectMany();

    return rows.map(row => ({
        startEpochMs: row.start.epochMilliseconds,
        endEpochMs: row.end.epochMilliseconds,
    }));
}

/**
 * Loads all enabled Duty Book teams for `eventId`, sorted alphabetically by team name.
 */
async function getEventDutyBookTeams(eventId: number): Promise<DutyBookTeamRecord[]> {
    'use cache';
    cacheLife('minutes');
    cacheTag('schedule2-duty-book-teams', `schedule2-duty-book-teams:${eventId}`);

    return await db.selectFrom(tEventsTeams)
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tEventsTeams.teamId))
                .and(tTeams.teamFlagEnableDutyBook.equals(/* true= */ 1))
                .and(tTeams.teamDeleted.isNull())
        .where(tEventsTeams.eventId.equals(eventId))
            .and(tEventsTeams.enableTeam.equals(/* true= */ 1))
        .select({
            id: tTeams.teamId,
            name: tTeams.teamName,
            slug: tTeams.teamSlug,
        })
        .orderBy(tTeams.teamName, 'asc')
        .executeSelectMany();
}

/**
 * Loads the visibility constraints of non-empty Knowledge Base categories for `eventId`.
 */
async function getEventKnowledgeCategories(eventId: number): Promise<KnowledgeCategoryRecord[]> {
    'use cache';
    cacheLife('minutes');
    cacheTag('schedule2-knowledge', `schedule2-knowledge:${eventId}`);

    return await db.selectFrom(tContentCategories)
        .innerJoin(tContent)
            .on(tContent.contentCategoryId.equals(tContentCategories.categoryId))
                .and(tContent.revisionVisible.equals(/* true= */ 1))
        .where(tContentCategories.eventId.equals(eventId))
            .and(tContentCategories.categoryDeleted.isNull())
        .select({
            id: tContentCategories.categoryId,
            roles: tContentCategories.categoryRoles,
            teams: tContentCategories.categoryTeams,
        })
        .groupBy(tContentCategories.categoryId)
        .executeSelectMany();
}

/**
 * Loads all program areas and timeslot windows for `festivalId`, sorted alphabetically by area
 * name. Callers compute live active counts against the effective portal clock.
 */
async function getProgramAreas(festivalId: number): Promise<ProgramAreaRecord[]> {
    'use cache';
    cacheLife('minutes');
    cacheTag('schedule2-program', `schedule2-program:${festivalId}`);

    const rows = await db.selectFrom(tActivities)
        .innerJoin(tActivitiesTimeslots)
            .on(tActivitiesTimeslots.activityId.equals(tActivities.activityId))
                .and(tActivitiesTimeslots.timeslotDeleted.isNull())
        .innerJoin(tActivitiesLocations)
            .on(tActivitiesLocations.locationId.equals(tActivitiesTimeslots.timeslotLocationId))
                .and(tActivitiesLocations.locationDeleted.isNull())
        .innerJoin(tActivitiesAreas)
            .on(tActivitiesAreas.areaId.equals(tActivitiesLocations.locationAreaId))
                .and(tActivitiesAreas.areaDeleted.isNull())
        .where(tActivities.activityFestivalId.equals(festivalId))
            .and(tActivities.activityType.equals(kActivityType.Program))
            .and(tActivities.activityDeleted.isNull())
        .select({
            areaId: tActivitiesAreas.areaId,
            areaName: tActivitiesAreas.areaDisplayName.valueWhenNull(tActivitiesAreas.areaName),
            start: tActivitiesTimeslots.timeslotStartTime,
            end: tActivitiesTimeslots.timeslotEndTime,
        })
        .executeSelectMany();

    const areas = new Map<number, ProgramAreaRecord>();
    for (const row of rows) {
        let area = areas.get(row.areaId);
        if (!area) {
            area = { id: row.areaId, name: row.areaName, timeslots: [] };
            areas.set(row.areaId, area);
        }

        area.timeslots.push({
            startEpochMs: row.start.epochMilliseconds,
            endEpochMs: row.end.epochMilliseconds,
        });
    }

    return [ ...areas.values() ].sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));
}

/**
 * Fetches live unread Duty Book entry counts per team for `userId` in `eventId`.
 */
async function getUnreadDutyBookCounts(
    eventId: number, userId: number, teamIds: number[]): Promise<Map<number, number>>
{
    const unreadByTeam = new Map<number, number>();
    if (!teamIds.length)
        return unreadByTeam;

    const dutyBookViewersJoin = tDutyBookViewers.forUseInLeftJoin();
    const rows = await db.selectFrom(tDutyBook)
        .leftJoin(dutyBookViewersJoin)
            .on(dutyBookViewersJoin.dutyBookId.equals(tDutyBook.dutyBookId))
                .and(dutyBookViewersJoin.dutyBookViewerUserId.equals(userId))
        .where(tDutyBook.dutyBookEventId.equals(eventId))
            .and(tDutyBook.dutyBookTeamId.in(teamIds))
            .and(tDutyBook.dutyBookDeleted.isNull())
            .and(dutyBookViewersJoin.dutyBookId.isNull())
        .select({
            teamId: tDutyBook.dutyBookTeamId,
            unread: db.countAll(),
        })
        .groupBy(tDutyBook.dutyBookTeamId)
        .executeSelectMany();

    for (const row of rows)
        unreadByTeam.set(row.teamId, row.unread);

    return unreadByTeam;
}

/**
 * Fetches the live count of unacknowledged Help Requests for `eventId`.
 */
async function getPendingHelpRequestCount(eventId: number): Promise<number> {
    return await db.selectFrom(tDisplaysRequests)
        .where(tDisplaysRequests.requestEventId.equals(eventId))
            .and(tDisplaysRequests.requestAcknowledgedBy.isNull())
        .selectCountAll()
        .executeSelectOne();
}

/**
 * Evaluates whether the signed-in user can see at least one Knowledge Base category, only querying
 * `tUsersEvents` for role IDs when role-restricted categories could grant visibility.
 */
async function resolveKnowledgeBaseVisibility(
    categories: KnowledgeCategoryRecord[], eventId: number, userId: number,
    hasUnrestrictedAccess: boolean, memberTeams?: ReadonlySet<string>): Promise<boolean>
{
    if (!categories.length)
        return false;

    if (hasUnrestrictedAccess)
        return true;

    const teamMatches = (teams: string) =>
        !teams.length || (!!memberTeams && teams.split(',').some(team => memberTeams.has(team)));

    const teamEligible = categories.filter(category => teamMatches(category.teams));
    if (!teamEligible.length)
        return false;

    if (teamEligible.some(category => !category.roles.length))
        return true;

    const roleIds = await db.selectFrom(tUsersEvents)
        .where(tUsersEvents.eventId.equals(eventId))
            .and(tUsersEvents.userId.equals(userId))
            .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
        .selectOneColumn(tUsersEvents.roleId)
        .executeSelectMany();

    const userRoleIds = new Set(roleIds.map(id => `${id}`));
    return teamEligible.some(category =>
        category.roles.split(',').some(role => userRoleIds.has(role)));
}
