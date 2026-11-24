// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Filters } from '../Filters';
import type { LineGraphData } from '../components/LineGraph';
import { toLineGraphData } from './toLineGraphData';
import db, { tEvents, tTeams, tUsersEvents } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Query that gathers the percentage of the team that decided to participate again in the following
 * event, or the event following that one. This means that retention for 2023 would be considered at
 * 50% if half the volunteers participated again in either 2024 or 2025. Two years are considered as
 * volunteers frequently miss a year due to personal circumstances.
 */
export async function getRetention(filters: Filters): Promise<LineGraphData> {
    const dbInstance = db;

    const firstSubsequentEvent = tEvents.as('fse');
    const secondSunsequentEvent = tEvents.as('sse');

    const priorUserEventsJoin = tUsersEvents.forUseInLeftJoinAs('puej');
    const usersEventsJoin = tUsersEvents.forUseInLeftJoin();

    // Select the Event ID of the event immediately after to the one being considered:
    const selectFirstSubsequentEvent = dbInstance.subSelectUsing(tEvents)
        .from(firstSubsequentEvent)
        .where(firstSubsequentEvent.eventStartTime.greaterThan(tEvents.eventStartTime))
        .selectOneColumn(firstSubsequentEvent.eventId)
        .orderBy(firstSubsequentEvent.eventStartTime, 'asc')
        .limit(1)
        .forUseAsInlineQueryValue();

    // Select the Event ID of the event two festivals after the one being considered:
    const selectSecondSubsequentEvent = dbInstance.subSelectUsing(tEvents)
        .from(secondSunsequentEvent)
        .where(secondSunsequentEvent.eventStartTime.greaterThan(tEvents.eventStartTime))
        .selectOneColumn(secondSunsequentEvent.eventId)
        .orderBy(secondSunsequentEvent.eventStartTime, 'asc')
        .limit(1).offset(1)
        .forUseAsInlineQueryValue();

    const data = await db.selectFrom(tEvents)
        .innerJoin(tTeams)
            .on(tTeams.teamId.inIfValue(filters.teams.map(team => team.id)))
        .leftJoin(usersEventsJoin)
            .on(usersEventsJoin.eventId.equals(tEvents.eventId))
                .and(usersEventsJoin.teamId.equals(tTeams.teamId))
                .and(usersEventsJoin.registrationStatus.equals(kRegistrationStatus.Accepted))
        .leftJoin(priorUserEventsJoin)
            .on(priorUserEventsJoin.eventId.equals(selectFirstSubsequentEvent).or(
                priorUserEventsJoin.eventId.equals(selectSecondSubsequentEvent)))
                .and(priorUserEventsJoin.userId.equals(usersEventsJoin.userId))
                .and(priorUserEventsJoin.registrationStatus.equals(kRegistrationStatus.Accepted))
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
            previousEvent: priorUserEventsJoin.eventId,
            volunteers: dbInstance.aggregateAsArrayOfOneColumn(usersEventsJoin.userId),
        })
        .groupBy(tEvents.eventId, tTeams.teamId, priorUserEventsJoin.eventId)
        .orderBy(tEvents.eventStartTime)
        .executeSelectMany();

    type EventMetrics = Map<string, {
        volunteers: Set<number>;
        retained: Set<number>;
    }>;

    type SeriesInfo = {
        id: string;
        color: string;
        label: string;
    };

    const events = new Map<string, EventMetrics>();
    const eventArray: string[] = [ /* empty */ ];
    const series = new Map<string, SeriesInfo>();

    for (const entry of data) {
        if (!events.has(entry.event.slug)) {
            events.set(entry.event.slug, new Map);
            eventArray.push(entry.event.slug);
        }

        if (!series.has(entry.series.id))
            series.set(entry.series.id, entry.series);

        const event = events.get(entry.event.slug)!;
        if (!event.has(entry.series.id)) {
            event.set(entry.series.id, {
                volunteers: new Set(),
                retained: new Set(),
            });
        }

        const team = event.get(entry.series.id)!;
        for (const volunteer of entry.volunteers) {
            if (!!entry.previousEvent)
                team.retained.add(volunteer);

            team.volunteers.add(volunteer);
        }
    }

    return toLineGraphData(eventArray.map(slug => {
        const event = events.get(slug)!;
        return [ ...event.entries() ].map(([ team, { volunteers, retained } ]) => {
            return {
                event: { slug },
                series: series.get(team)!,
                value: (!volunteers.size || !retained.size) ? 0
                                                            : retained.size / volunteers.size,
            };
        });

    }).flat());
}
