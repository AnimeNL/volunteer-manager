// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';
import { cache } from 'react';

import type { NavigationData } from './navigationTypes';
import { getEventState } from '@lib/event';
import { getScheduleAccess } from './getScheduleAccess';
import { getVolunteerTeams } from './data/volunteerData';
import { hasKnowledgeBaseAccess } from './data/knowledgeData';
import { readUserSettings } from '@lib/UserSettings';

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
        const memberTeams = events.get(event.slug);
        const hasUnrestrictedKnowledge = access.can('event.knowledge', { event: event.slug });

        const [ eventState, hasKnowledgeBase, userSettings, visibleVolunteerTeams ] =
            await Promise.all([
                getEventState(event),
                hasKnowledgeBaseAccess(event.id, user.id, hasUnrestrictedKnowledge),
                readUserSettings(user.id, [
                    'user-schedule-expand-duty-book',
                    'user-schedule-expand-events',
                    'user-schedule-expand-volunteers',
                ], /* disableFallback= */ true),
                getVolunteerTeams(scheduleContext),
            ]);

        const areas = (eventState?.program.getAreas({ programOnly: true }) ?? []).map(area => ({
            id: area.id,
            name: area.name,
        }));

        const dutyBooks = (eventState?.volunteers.getTeams() ?? [])
            .filter(team =>
                team.enableDutyBook && (
                    memberTeams?.has(team.slug) ||
                    access.can('event.duty-book', 'read', { event: event.slug, team: team.slug })))
            .map(team => ({ name: team.name, team: team.slug }));

        const volunteerTeams = visibleVolunteerTeams.map(team => ({
            name: team.name,
            slug: team.slug,
        }));

        const hasHelpRequests = access.can('event.help-requests', { event: event.slug });

        return {
            areas,
            dutyBooks,
            eventSlug: event.slug,
            expandDutyBook: userSettings['user-schedule-expand-duty-book'] ?? false,
            expandEvents: userSettings['user-schedule-expand-events'] ?? true,
            expandVolunteers: userSettings['user-schedule-expand-volunteers'] ?? false,
            hasHelpRequests,
            hasKnowledgeBase,
            volunteerTeams,
        };
    });
