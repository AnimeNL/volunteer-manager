// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Filters } from '../Filters';
import type { LineGraphData } from '../components/LineGraph';
import { toLineGraphData } from './toLineGraphData';
import db, { tEvents, tTeams, tUsersEvents } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Computes the fraction (0-1) that the `share` represents of the `total`. Safely deals with
 * zero values for either argument.
 */
function safeFraction(share: number, total: number): number {
    if (share === 0 || total === 0)
        return 0;

    return share / total;
}

/**
 * Query that gathers the acceptance, rejection and cancellation rates of received applications in
 * a particular event, filtered according to the given `filters`.
 */
export async function getApplicationStatus(filters: Filters): Promise<LineGraphData> {
    const usersEventsJoin = tUsersEvents.forUseInLeftJoin();

    const data = await db.selectFrom(tEvents)
        .innerJoin(tTeams)
            .on(tTeams.teamId.inIfValue(filters.teams.map(team => team.id)))
        .leftJoin(usersEventsJoin)
            .on(usersEventsJoin.eventId.equals(tEvents.eventId))
                .and(usersEventsJoin.teamId.equals(tTeams.teamId))
        .where(tEvents.eventId.inIfValue(filters.events.map(event => event.id)))
        .select({
            event: {
                slug: tEvents.eventSlug,
            },
            status: usersEventsJoin.registrationStatus,
            volunteers: db.count(usersEventsJoin.userId),
        })
        .groupBy(tEvents.eventId, usersEventsJoin.registrationStatus)
        .orderBy(tEvents.eventStartTime)
        .executeSelectMany();

    type EventMetrics = {
        [kRegistrationStatus.Accepted]: number;
        [kRegistrationStatus.Cancelled]: number;
        [kRegistrationStatus.Registered]: number;
        [kRegistrationStatus.Rejected]: number;
    };

    const events = new Map<string, EventMetrics>();
    const eventArray: string[] = [ /* empty */ ];

    for (const { event, status, volunteers } of data) {
        if (!events.has(event.slug)) {
            events.set(event.slug, {
                [kRegistrationStatus.Accepted]: 0,
                [kRegistrationStatus.Cancelled]: 0,
                [kRegistrationStatus.Registered]: 0,
                [kRegistrationStatus.Rejected]: 0,
            });

            eventArray.push(event.slug);
        }

        events.get(event.slug)![status!] += volunteers;
    }

    return toLineGraphData(eventArray.map(slug => {
        const statuses = events.get(slug)!;
        const total =
            statuses[kRegistrationStatus.Accepted] + statuses[kRegistrationStatus.Cancelled] +
            statuses[kRegistrationStatus.Registered] + statuses[kRegistrationStatus.Rejected];

        return [
            {
                event: { slug },
                series: {
                    id: kRegistrationStatus.Accepted,
                    color: '#8BC34A',
                    label: kRegistrationStatus.Accepted,
                },
                value: safeFraction(statuses[kRegistrationStatus.Accepted], total),
            },
            {
                event: { slug },
                series: {
                    id: kRegistrationStatus.Cancelled,
                    color: '#FF7043',
                    label: kRegistrationStatus.Cancelled,
                },
                value: safeFraction(statuses[kRegistrationStatus.Cancelled], total),
            },
            {
                event: { slug },
                series: {
                    id: kRegistrationStatus.Registered,
                    color: '#BDBDBD',
                    label: kRegistrationStatus.Registered,
                },
                value: safeFraction(statuses[kRegistrationStatus.Registered], total),
            },
            {
                event: { slug },
                series: {
                    id: kRegistrationStatus.Rejected,
                    color: '#8D6E63',
                    label: kRegistrationStatus.Rejected,
                },
                value: safeFraction(statuses[kRegistrationStatus.Rejected], total),
            },
        ];

    }).flat());
}
