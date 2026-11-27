// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';
import { cache } from 'react';
import { cacheLife, cacheTag } from 'next/cache';

import type { NavigationData } from './navigationTypes';
import { getProgramAreas } from './data/programData';
import { getScheduleAccess } from './getScheduleAccess';
import { hasKnowledgeBaseAccess } from './data/knowledgeData';
import { readUserSettings } from '@lib/UserSettings';
import db, { tEventsTeams, tTeams } from '@lib/database';

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
        const scheduleContext = await getScheduleAccess(eventSlug);
        if (!scheduleContext)
            return undefined;

        const { access, event, events, user } = scheduleContext;
        const festivalId = event.integrations?.anPlanFestivalId;
        const memberTeams = events.get(event.slug);
        const hasUnrestrictedKnowledge = access.can('event.knowledge', { event: event.slug });

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
                access.can('event.duty-book', 'read', { event: event.slug, team: team.slug }))
            .map(team => ({ name: team.name, team: team.slug }));

        const hasHelpRequests = access.can('event.help-requests', { event: event.slug });

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
