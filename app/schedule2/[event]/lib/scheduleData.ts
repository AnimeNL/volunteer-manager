// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';
import { cache } from 'react';
import { cacheLife, cacheTag } from 'next/cache';

import type { NavigationArea, NavigationData } from './navigationTypes';
import { getScheduleAccess } from './getScheduleAccess';
import { hasKnowledgeBaseAccess } from './data/knowledgeData';
import { readUserSettings } from '@lib/UserSettings';
import db, { tActivities, tActivitiesAreas, tActivitiesLocations, tActivitiesTimeslots,
    tEventsTeams, tTeams } from '@lib/database';

import { kActivityType } from '@lib/database/Types';

/**
 * Serializable Duty Book-enabled team record cached per event.
 */
interface DutyBookTeamRecord {
    id: number;
    name: string;
    slug: string;
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
        const hasUnrestrictedKnowledge = permissions.can('event.knowledge', { event: event.slug });

        const [ areas, dutyBookTeams, hasKnowledgeBase, userSettings ] =
            await Promise.all([
                festivalId ? getProgramAreas(festivalId) : Promise.resolve([]),
                getEventDutyBookTeams(event.id),
                hasKnowledgeBaseAccess(event.id, user.id, hasUnrestrictedKnowledge),
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

        return {
            areas,
            dutyBooks,
            eventSlug: event.slug,
            expandDutyBook: userSettings['user-schedule-expand-duty-book'] ?? false,
            expandEvents: userSettings['user-schedule-expand-events'] ?? true,
            hasHelpRequests,
            hasKnowledgeBase,
        };
    });

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
