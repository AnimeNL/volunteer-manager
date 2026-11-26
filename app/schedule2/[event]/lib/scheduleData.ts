// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';
import { cache } from 'react';
import { cacheLife, cacheTag } from 'next/cache';

import type { NavigationArea, NavigationData } from './navigationTypes';
import { getScheduleAccess } from './getScheduleAccess';
import { readUserSettings } from '@lib/UserSettings';
import db, { tActivities, tActivitiesAreas, tActivitiesLocations, tActivitiesTimeslots, tContent,
    tContentCategories, tEventsTeams, tTeams, tUsersEvents, tUsersEventsFavourites }
    from '@lib/database';

import { kActivityType, kRegistrationStatus } from '@lib/database/Types';

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

        const { access: permissions, event, events, user } = access;
        const festivalId = event.integrations?.anPlanFestivalId;
        const memberTeams = events.get(event.slug);

        const isVolunteer = !!memberTeams?.size;

        const [ hasSchedule, areas, dutyBookTeams, knowledgeCategories, userSettings ] =
            await Promise.all([
                isVolunteer ? Promise.resolve(true) : hasUserEventSchedule(event.id, user.id),
                festivalId ? getProgramAreas(festivalId) : Promise.resolve([]),
                getEventDutyBookTeams(event.id),
                getEventKnowledgeCategories(event.id),
                readUserSettings(user.id, [
                    'user-schedule-expand-duty-book',
                    'user-schedule-expand-events',
                ], /* disableFallback= */ true),
            ]);

        const dutyBooks = dutyBookTeams
            .filter(team =>
                memberTeams?.has(team.slug) ||
                permissions.can('event.duty-book', 'read', { event: event.slug, team: team.slug }))
            .map(team => ({ name: team.name, team: team.slug }));

        const hasHelpRequests = permissions.can('event.help-requests', { event: event.slug });
        const hasUnrestrictedKnowledge = permissions.can('event.knowledge', { event: event.slug });

        const hasKnowledgeBase = await resolveKnowledgeBaseVisibility(
            knowledgeCategories, event.id, user.id, hasUnrestrictedKnowledge, memberTeams);

        return {
            areas,
            dutyBooks,
            eventSlug: event.slug,
            expandDutyBook: userSettings['user-schedule-expand-duty-book'] ?? false,
            expandEvents: userSettings['user-schedule-expand-events'] ?? true,
            hasHelpRequests,
            hasKnowledgeBase,
            hasSchedule,
        };
    });

/**
 * Returns whether `userId` is an accepted volunteer or has at least one favourited activity in
 * `eventId`.
 */
async function hasUserEventSchedule(eventId: number, userId: number): Promise<boolean> {
    'use cache';
    cacheLife('minutes');
    cacheTag(
        'schedule-favourites', `schedule-favourites:${eventId}:${userId}`,
        'schedule-volunteers', `schedule-volunteers:${eventId}:${userId}`);

    const [ volunteerCount, favouriteCount ] = await Promise.all([
        db.selectFrom(tUsersEvents)
            .where(tUsersEvents.eventId.equals(eventId))
                .and(tUsersEvents.userId.equals(userId))
                .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
            .selectCountAll()
            .executeSelectOne(),
        db.selectFrom(tUsersEventsFavourites)
            .where(tUsersEventsFavourites.eventId.equals(eventId))
                .and(tUsersEventsFavourites.userId.equals(userId))
            .selectCountAll()
            .executeSelectOne(),
    ]);

    return volunteerCount > 0 || favouriteCount > 0;
}

/**
 * Loads all enabled Duty Book teams for `eventId`, sorted alphabetically by team name.
 */
async function getEventDutyBookTeams(eventId: number): Promise<DutyBookTeamRecord[]> {
    'use cache';
    cacheLife('minutes');
    cacheTag('schedule-duty-book-teams', `schedule-duty-book-teams:${eventId}`);

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
    cacheTag('schedule-knowledge', `schedule-knowledge:${eventId}`);

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
 * Loads all program areas for `festivalId` that have at least one scheduled timeslot, sorted
 * alphabetically by display name.
 */
async function getProgramAreas(festivalId: number): Promise<NavigationArea[]> {
    'use cache';
    cacheLife('minutes');
    cacheTag('schedule-program', `schedule-program:${festivalId}`);

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
            id: tActivitiesAreas.areaId,
            name: tActivitiesAreas.areaDisplayName.valueWhenNull(tActivitiesAreas.areaName),
        })
        .groupBy(tActivitiesAreas.areaId)
        .executeSelectMany();

    return rows.sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));
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
