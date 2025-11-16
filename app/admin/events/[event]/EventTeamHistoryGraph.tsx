// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import db, { tEvents, tUsersEvents } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

/**
 * How many days should be compared within the comparable graphs?
 */
const kTeamHistoryComparisonDays = 180;

/**
 * How many events should be considered in the team history?
 */
const kTeamHistoryComparisonEvents = 4;

/**
 * Props accepted by the <EventTeamHistoryGraph> component.
 */
interface EventTeamHistoryGraphProps {
    /**
     * Unique ID of the event for which history should be shown.
     */
    eventId: number;

    /**
     * Unique ID of the team for which histroy should be shown.
     */
    teamId: number;
}

/**
 * The <EventTeamHistoryGraph> component displays a multi-year comparison graph showing the growth
 * of the volunteering team, based on the date at which the volunteers registered to participate.
 */
export async function EventTeamHistoryGraph(props: EventTeamHistoryGraphProps) {
    const series: any = [];

    // ---------------------------------------------------------------------------------------------
    // Delay loading the event team history graph by anything between 0 and 2 seconds, to spread out
    // the number of queries we fire to the database. These graphs will never open immediately, and
    // may each create up to five database queries.

    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000));

    // ---------------------------------------------------------------------------------------------
    // Determine the events that should be compared.

    const dbInstance = db;

    const events = await dbInstance.selectFrom(tEvents)
        .where(tEvents.eventId.lessOrEquals(props.eventId))
        .select({
            id: tEvents.eventId,
            name: tEvents.eventShortName,
        })
        .orderBy(tEvents.eventEndTime, 'desc')
        .limit(kTeamHistoryComparisonEvents)
        .executeSelectMany();

    // ---------------------------------------------------------------------------------------------
    // Determine the registration dates for volunteers across these events. This is done by
    // considering their registration date relative to the event's start time, then aggregated over
    // the configured number of days ahead of the event's start.

    const daysFromEvent = dbInstance.fragmentWithType('int', 'optional')
        .sql`DATEDIFF(${tEvents.eventStartTime}, ${tUsersEvents.registrationDate})`;

    let currentSeriesColourIndex = 0;
    let currentId = 1;

    for (const event of events) {
        const applicationData = await dbInstance.selectFrom(tUsersEvents)
            .innerJoin(tEvents)
                .on(tEvents.eventId.equals(tUsersEvents.eventId))
            .where(tUsersEvents.eventId.equals(event.id))
                .and(tUsersEvents.teamId.equals(props.teamId))
                .and(tUsersEvents.registrationDate.isNotNull())
                .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
            .select({
                days: daysFromEvent,
                applications: dbInstance.count(tUsersEvents.userId),
            })
            .groupBy('days')
            .orderBy('days', 'desc')
            .executeSelectMany();

        const applicationsByDay = new Map<number, number>();
        for (const { days, applications } of applicationData) {
            const clampedDays = Math.min(Math.max(0, days!), kTeamHistoryComparisonDays);
            const currentApplications = applicationsByDay.get(clampedDays) || 0;

            applicationsByDay.set(clampedDays, currentApplications + applications);
        }

        const aggregateApplicationData: number[] = [ /* no data yet */ ];

        let aggregateApplications: number = 0;
        for (let day = kTeamHistoryComparisonDays; day >= 0; --day) {
            aggregateApplications += applicationsByDay.get(day) || 0;
            aggregateApplicationData.push(aggregateApplications);
        }

        series.push({
            id: currentId++,
            data: aggregateApplicationData,
            //color: kComparisonEditionColours[currentSeriesColourIndex++],
            label: event.name,
            type: 'line',
        });
    }

    // ---------------------------------------------------------------------------------------------

    // TODO: FIXME
    return undefined;
}
