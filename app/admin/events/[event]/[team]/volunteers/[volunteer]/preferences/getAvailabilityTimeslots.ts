// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { formatDate } from '@lib/Temporal';
import { getEvent } from '@lib/cache';
import { readSetting } from '@lib/Settings';
import db, { tActivities, tActivitiesTimeslots } from '@lib/database';

/**
 * Represents a timeslot that a volunteer can select in their preferences.
 */
interface Timeslot {
    /**
     * Unique AnPlan timeslot ID.
     */
    id: number;

    /**
     * Label to display in the autocomplete input.
     */
    label: string;
}

/**
 * Fetches the program timeslots that a volunteer can request to attend.
 */
export async function getAvailabilityTimeslots(eventId: number): Promise<Timeslot[]> {
    const maxDurationMinutes =
        await readSetting('availability-max-event-duration-minutes') ?? Number.MAX_SAFE_INTEGER;

    const event = await getEvent(eventId);
    const timeslots: Timeslot[] = [];

    if (!event?.integrations?.anPlanFestivalId)
        return timeslots;

    const activityTimeslots = await db.selectFrom(tActivities)
        .innerJoin(tActivitiesTimeslots)
            .on(tActivitiesTimeslots.activityId.equals(tActivities.activityId))
            .and(tActivitiesTimeslots.timeslotDeleted.isNull())
        .where(tActivities.activityFestivalId.equals(event.integrations.anPlanFestivalId))
            .and(tActivities.activityType.equals('Program'))
            .and(tActivities.activityDeleted.isNull())
        .select({
            id: tActivitiesTimeslots.timeslotId,
            title: tActivities.activityTitle,
            startTime: tActivitiesTimeslots.timeslotStartTime,
            endTime: tActivitiesTimeslots.timeslotEndTime,
        })
        .orderBy(tActivities.activityTitle, 'asc')
        .orderBy(tActivitiesTimeslots.timeslotStartTime, 'asc')
        .executeSelectMany();

    for (const timeslot of activityTimeslots) {
        const duration = timeslot.startTime.until(timeslot.endTime, { largestUnit: 'minute' });
        if (duration.minutes < 0 || duration.minutes > maxDurationMinutes)
            continue;

        const localStartTime = timeslot.startTime.withTimeZone(event.timeZone);
        const localStartTimeStr = formatDate(localStartTime, 'dddd, HH:mm');

        const localEndTime = timeslot.endTime.withTimeZone(event.timeZone);
        const localEndTimeStr = formatDate(localEndTime, 'HH:mm');

        timeslots.push({
            id: timeslot.id,
            label: `${timeslot.title} (${localStartTimeStr}–${localEndTimeStr})`,
        });
    }

    return timeslots;
}
