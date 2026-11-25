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
 * Serializable scheduled shift record returned from the cached shift loader.
 */
interface ScheduledShiftRecord {
    description?: string;
    endEpochMs: number;
    id: number;
    location: string;
    shiftId: number;
    startEpochMs: number;
    title: string;
}

/**
 * Serializable program area record returned from the cached program loader.
 */
interface ProgramAreaRecord {
    id: number;
    locations: { id: number; name: string }[];
    name: string;
    timeslots: { endEpochMs: number; startEpochMs: number }[];
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
 * Loads all scheduled shifts for `userId` in `eventId`, ordered chronologically. Timestamps are
 * returned as epoch milliseconds so the result serializes cleanly across `'use cache'` boundaries.
 */
async function getUserEventShifts(
    eventId: number, userId: number): Promise<ScheduledShiftRecord[]>
{
    'use cache';
    cacheLife('minutes');
    cacheTag('schedule2-shifts', `schedule2-shifts:${eventId}:${userId}`);

    const activityJoin = tActivities.forUseInLeftJoin();
    const activityLocationJoin = tActivitiesLocations.forUseInLeftJoinAs('alj');
    const shiftLocationJoin = tActivitiesLocations.forUseInLeftJoinAs('slj');

    const rows = await db.selectFrom(tSchedule)
        .innerJoin(tShifts)
            .on(tShifts.shiftId.equals(tSchedule.shiftId))
                .and(tShifts.shiftDeleted.isNull())
        .leftJoin(shiftLocationJoin)
            .on(shiftLocationJoin.locationId.equals(tShifts.shiftLocationId))
        .leftJoin(activityJoin)
            .on(activityJoin.activityId.equals(tShifts.shiftActivityId))
        .leftJoin(activityLocationJoin)
            .on(activityLocationJoin.locationId.equals(activityJoin.activityLocationId))
        .where(tSchedule.eventId.equals(eventId))
            .and(tSchedule.userId.equals(userId))
            .and(tSchedule.scheduleDeleted.isNull())
        .select({
            id: tSchedule.scheduleId,
            shiftId: tShifts.shiftId,
            title: tShifts.shiftName,
            description: tShifts.shiftDescription,
            shiftLocation: shiftLocationJoin.locationDisplayName.valueWhenNull(
                shiftLocationJoin.locationName),
            activityLocation: activityLocationJoin.locationDisplayName.valueWhenNull(
                activityLocationJoin.locationName),
            start: tSchedule.scheduleTimeStart,
            end: tSchedule.scheduleTimeEnd,
        })
        .orderBy(tSchedule.scheduleTimeStart, 'asc')
        .executeSelectMany();

    return rows.map(row => ({
        id: row.id,
        shiftId: row.shiftId,
        title: row.title,
        description: row.description ?? undefined,
        location: row.shiftLocation || row.activityLocation || 'Volunteer Lounge',
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
 * Loads all program areas, locations, and timeslot windows for `festivalId`, sorted alphabetically
 * by area name. Callers compute live active counts against the effective portal clock.
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
            locationId: tActivitiesLocations.locationId,
            locationName: tActivitiesLocations.locationDisplayName.valueWhenNull(
                tActivitiesLocations.locationName),
            start: tActivitiesTimeslots.timeslotStartTime,
            end: tActivitiesTimeslots.timeslotEndTime,
        })
        .executeSelectMany();

    const areas = new Map<number, {
        id: number;
        locationMap: Map<number, string>;
        name: string;
        timeslots: { endEpochMs: number; startEpochMs: number }[];
    }>();

    for (const row of rows) {
        let area = areas.get(row.areaId);
        if (!area) {
            area = {
                id: row.areaId,
                name: row.areaName,
                locationMap: new Map(),
                timeslots: [],
            };
            areas.set(row.areaId, area);
        }

        area.locationMap.set(row.locationId, row.locationName);
        area.timeslots.push({
            startEpochMs: row.start.epochMilliseconds,
            endEpochMs: row.end.epochMilliseconds,
        });
    }

    return [ ...areas.values() ]
        .map(area => ({
            id: area.id,
            name: area.name,
            locations: [ ...area.locationMap.entries() ]
                .map(([ id, name ]) => ({ id, name }))
                .sort((lhs, rhs) => lhs.name.localeCompare(rhs.name)),
            timeslots: area.timeslots,
        }))
        .sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));
}

/**
 * Fetches live per-team Duty Book unread counts and/or pending Help Requests count in at most one
 * database round-trip using inline sub-queries.
 */
async function getLiveNavigationCounts(
    eventId: number, userId: number, dutyBookTeamIds: number[], includeHelpRequests: boolean)
    : Promise<{ pendingHelpRequests?: number; unreadByTeam: Map<number, number> }>
{
    const unreadByTeam = new Map<number, number>();
    if (!dutyBookTeamIds.length && !includeHelpRequests)
        return { unreadByTeam };

    const dbInstance = db;

    const pendingHelpRequestsSubQuery = dbInstance.selectFrom(tDisplaysRequests)
        .where(tDisplaysRequests.requestEventId.equals(eventId))
            .and(tDisplaysRequests.requestAcknowledgedBy.isNull())
        .selectCountAll()
        .forUseAsInlineQueryValue();

    if (!dutyBookTeamIds.length) {
        const result = await dbInstance.selectFromNoTable()
            .select({ pendingHelpRequests: pendingHelpRequestsSubQuery })
            .executeSelectOne();

        return {
            pendingHelpRequests: result.pendingHelpRequests,
            unreadByTeam,
        };
    }

    const dutyBookViewersJoin = tDutyBookViewers.forUseInLeftJoin();
    const unreadSubQuery = dbInstance.subSelectUsing(tTeams)
        .from(tDutyBook)
        .leftJoin(dutyBookViewersJoin)
            .on(dutyBookViewersJoin.dutyBookId.equals(tDutyBook.dutyBookId))
                .and(dutyBookViewersJoin.dutyBookViewerUserId.equals(userId))
        .where(tDutyBook.dutyBookEventId.equals(eventId))
            .and(tDutyBook.dutyBookTeamId.equals(tTeams.teamId))
            .and(tDutyBook.dutyBookDeleted.isNull())
            .and(dutyBookViewersJoin.dutyBookId.isNull())
        .selectCountAll()
        .forUseAsInlineQueryValue();

    const rows = await dbInstance.selectFrom(tTeams)
        .where(tTeams.teamId.in(dutyBookTeamIds))
        .select({
            teamId: tTeams.teamId,
            unread: unreadSubQuery,
            pendingHelpRequests: includeHelpRequests
                ? pendingHelpRequestsSubQuery
                : dbInstance.const(0, 'int'),
        })
        .executeSelectMany();

    for (const row of rows)
        unreadByTeam.set(row.teamId, row.unread);

    return {
        pendingHelpRequests: includeHelpRequests ? (rows[0]?.pendingHelpRequests ?? 0) : undefined,
        unreadByTeam,
    };
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

        const [ shifts, programAreas, dutyBookTeams, knowledgeCategories ] = await Promise.all([
            getUserEventShifts(event.id, user.id),
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

        const [ liveCounts, hasKnowledgeBase ] = await Promise.all([
            getLiveNavigationCounts(
                event.id, user.id, accessibleDutyBooks.map(t => t.id), canViewHelpRequests),
            resolveKnowledgeBaseVisibility(
                knowledgeCategories, event.id, user.id, hasUnrestrictedKnowledge, memberTeams),
        ]);

        const currentMs = currentTime.epochMilliseconds;
        const hasActiveShift = shifts.some(
            shift => shift.startEpochMs <= currentMs && shift.endEpochMs > currentMs);

        const areas = programAreas.map(area => ({
            activeCount: area.timeslots.reduce(
                (count, slot) => count + (
                    slot.startEpochMs <= currentMs && slot.endEpochMs > currentMs ? 1 : 0),
                0),
            id: area.id,
            name: area.name,
        }));

        const dutyBooks = accessibleDutyBooks.map(team => ({
            name: team.name,
            team: team.slug,
            unread: liveCounts.unreadByTeam.get(team.id) ?? 0,
        }));

        return {
            areas,
            dutyBooks,
            eventSlug: event.slug,
            hasActiveShift,
            hasKnowledgeBase,
            hasSettings,
            hasShifts: shifts.length > 0,
            helpRequests: liveCounts.pendingHelpRequests !== undefined
                ? { pending: liveCounts.pendingHelpRequests }
                : undefined,
        };
    });
