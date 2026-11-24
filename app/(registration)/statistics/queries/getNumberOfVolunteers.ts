// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Filters } from '../Filters';
import type { LineGraphData } from '../components/LineGraph';
import { toLineGraphData } from './toLineGraphData';
import db, { tEvents, tTeams, tUsersEvents } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Query that gathers the number of volunteers for each of the years and teams included in the
 * `filters`. The data is intended to be displayed in a line graph.
 */
export async function getNumberOfVolunteers(filters: Filters): Promise<LineGraphData> {
    const usersEventsJoin = tUsersEvents.forUseInLeftJoin();

    const data = await db.selectFrom(tEvents)
        .innerJoin(tTeams)
            .on(tTeams.teamId.inIfValue(filters.teams.map(team => team.id)))
        .leftJoin(usersEventsJoin)
            .on(usersEventsJoin.eventId.equals(tEvents.eventId))
                .and(usersEventsJoin.teamId.equals(tTeams.teamId))
                .and(usersEventsJoin.registrationStatus.equals(kRegistrationStatus.Accepted))
        .where(tEvents.eventId.inIfValue(filters.events.map(event => event.id)))
        .select({
            event: {
                slug: tEvents.eventSlug,
            },
            series: {
                id: tTeams.teamSlug,
                color: tTeams.teamColourLightTheme,
                label: tTeams.teamName,
            },
            value: db.count(usersEventsJoin.userId),
        })
        .groupBy(tEvents.eventId, tTeams.teamId)
        .orderBy(tEvents.eventStartTime)
        .executeSelectMany();

    return toLineGraphData(data);
}
