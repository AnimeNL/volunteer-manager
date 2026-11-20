// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { getAuthenticationContext } from '@lib/auth';
import db, { tEvents, tEventsSalesConfiguration, tTeams } from '@lib/database';

/**
 * Filters that should be applied when fetching data for one of the statistics.
 */
export interface Filters {
    /**
     * Whether access should be granted at all, specific to the types of metrics that can be shown
     * on the Volunteer Manager. These map to individual permissions.
     */
    access: {
        basic: boolean;
        finances: boolean;
    },

    /**
     * Events that the signed in user has access to.
     */
    events: {
        /**
         * Unique ID of the event, as it exists in the database.
         */
        id: number;

        /**
         * Human-presentable name of the event.
         */
        name: string;

        /**
         * Unique slug identifying the event.
         */
        slug: string;

        /**
         * Whether sales information is available for this event.
         */
        hasSales: boolean;
    }[];

    /**
     * Teams that the signed in user has access to.
     */
    teams: {
        /**
         * Unique ID of the team, as it exists in the database.
         */
        id: number;

        /**
         * Human-presentable name of the team.
         */
        name: string;

        /**
         * Unique slug identifying the team.
         */
        slug: string;
    }[];
}

/**
 * Determines the filters applicable for the signed in user given the `params`. Their upper bound of
 * access is decided first, which is then limited by the `params` to avoid accidental data access.
 */
export async function determineFilters(params?: URLSearchParams): Promise<Filters> {
    const { access } = await getAuthenticationContext();

    // ---------------------------------------------------------------------------------------------

    let requestedEvents: Set<string> | undefined;
    if (params?.has('events'))
        requestedEvents = new Set(params.get('events')!.split(','));

    let requestedTeams: Set<string> | undefined;
    if (params?.has('teams'))
        requestedTeams = new Set(params.get('teams')!.split(','));

    const filters: Filters = {
        access: {
            basic: access.can('statistics.basic'),
            finances: access.can('statistics.finances'),
        },
        events: [ /* none */ ],
        teams: [ /* none */ ],
    };

    if (!filters.access.basic)
        return filters;

    // ---------------------------------------------------------------------------------------------

    const dbInstance = db;

    const eventsSalesConfigurationJoin = tEventsSalesConfiguration.forUseInLeftJoin();

    const eventsSubQuery = dbInstance.selectFrom(tEvents)
        .leftJoin(eventsSalesConfigurationJoin)
            .on(eventsSalesConfigurationJoin.eventId.equals(tEvents.eventId))
        .select({
            id: tEvents.eventId,
            name: tEvents.eventShortName,
            slug: tEvents.eventSlug,

            hasSales: dbInstance.count(eventsSalesConfigurationJoin.eventId).greaterThan(0),
        })
        .groupBy(tEvents.eventId)
        .orderBy(tEvents.eventStartTime, 'desc')
        .forUseAsInlineAggregatedArrayValue();

    const teamsSubQuery = dbInstance.selectFrom(tTeams)
        .select({
            id: tTeams.teamId,
            name: tTeams.teamName,
            slug: tTeams.teamSlug,
        })
        .forUseAsInlineAggregatedArrayValue();

    const { events, teams } = await dbInstance.selectFromNoTable()
        .select({
            events: eventsSubQuery,
            teams: teamsSubQuery,
        })
        .executeSelectOne();

    // ---------------------------------------------------------------------------------------------

    for (const { id, name, slug, hasSales } of events) {
        if (requestedEvents && !requestedEvents.has(slug))
            continue;  // this event has not been selected

        filters.events.push({ id, name, slug, hasSales });
    }

    for (const { id, name, slug } of teams) {
        if (requestedTeams && !requestedTeams.has(slug))
            continue;  // this team has not been selected

        filters.teams.push({ id, name, slug });
    }

    return filters;
}
