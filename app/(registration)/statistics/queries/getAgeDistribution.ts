// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Filters } from '../Filters';
import type { LineGraphData } from '../components/LineGraph';
import { toLineGraphData } from './toLineGraphData';
import db, { tEvents, tTeams, tUsers, tUsersEvents } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Query that gathers the average age of volunteers participating in our events. The age demographic
 * of visitors to the AnimeCon events continues to be in the low 20s, and while we expect volunteers
 * to be slightly older (few people help out in their first year) too much of a discrepancy will
 * potentially present a barrier for younger people to sign up.
 *
 * @todo Update this to a candlestick chart once MUI's Chart library supports this
 * @todo https://github.com/mui/mui-x/issues/13044
 */
export async function getAgeDistribution(filters: Filters): Promise<LineGraphData> {
    const usersEventsJoin = tUsersEvents.forUseInLeftJoin();
    const usersJoin = tUsers.forUseInLeftJoin();

    const data = await db.selectFrom(tEvents)
        .innerJoin(tTeams)
            .on(tTeams.teamId.inIfValue(filters.teams.map(team => team.id)))
        .leftJoin(usersEventsJoin)
            .on(usersEventsJoin.eventId.equals(tEvents.eventId))
                .and(usersEventsJoin.teamId.equals(tTeams.teamId))
                .and(usersEventsJoin.registrationStatus.equals(kRegistrationStatus.Accepted))
        .leftJoin(usersJoin)
            .on(usersJoin.userId.equals(usersEventsJoin.userId))
                .and(usersJoin.birthdate.isNotNull())
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
            value: db.average(
                db.fragmentWithType('double', 'required').sql`
                    TIMESTAMPDIFF(YEAR, ${usersJoin.birthdate}, ${tEvents.eventStartTime})`)
        })
        .groupBy(tEvents.eventId, tTeams.teamId)
        .orderBy(tEvents.eventStartTime)
        .executeSelectMany();

    return toLineGraphData(data.map(entry => ({
        ...entry,
        value: entry.value || 0,
    })));
}
