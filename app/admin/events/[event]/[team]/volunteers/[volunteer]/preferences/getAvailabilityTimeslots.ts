// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import db, { tActivities, tActivitiesTimeslots } from '@lib/database';

import { formatDate } from '@lib/Temporal';
import { getEvent } from '@lib/cache';
import { readSetting } from '@lib/Settings';

/**
 * Individual event that can be selected as a preference by the volunteer.
 */
interface Timeslot {
    /**
     * Unique AnPlan timeslot Id of the entry that can be selected by the volunteer.
     */
    id: number;

    /**
     * Label that should be displayed for this event in an autocomplete box.
     */
    label: string;
}

/**
 * Fetches the timeslots that a volunteer can request to attend as part of their preferences.
 */
export async function getAvailabilityTimeslots(eventId: number): Promise<Timeslot[]> {
    const maxDurationMinutes =
            await readSetting('availability-max-event-duration-minutes') ?? Number.MAX_SAFE_INTEGER;

    const event = await getEvent(eventId);
    const timeslots: Timeslot[] = [];

    // Bail out when the |event| does not have an associated AnPlan ID.
    if (!event?.integrations?.anPlanFestivalId)
        return timeslots;

    const activityTimeslots = await db.selectFrom(tActivities)
        .innerJoin(tActivitiesTimeslots)
            .on(tActivitiesTimeslots.activityId.equals(tActivities.activityId))
            .and(tActivitiesTimeslots.timeslotDeleted.isNull())
        .where(tActivities.activityFestivalId.equals(event.integrations.anPlanFestivalId))
            .and(tActivities.activityType.equals('Program'))
            //.and(tActivities.activityVisible.equals(/* true= */ 1))
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
            continue;  // this event exceeds the duration cutoff

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
