// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { DateTime } from '@lib/DateTime';
import { ActivityType } from '@lib/database/Types';
import { readSetting } from '@lib/Settings';
import db, { tActivities, tActivitiesTimeslots } from '@lib/database';

/**
 * Individual event that can be selected as a preference by the volunteer.
 */
export interface EventTimeslotEntry {
    /**
     * Unique AnPlan timeslot Id of the entry that can be selected by the volunteer.
     */
    id: number;

    /**
     * Label that should be displayed for this event in an autocomplete box.
     */
    label: string;

    /**
     * Time at which the event will start. Only when the `withTimingInfo` flag is set.
     */
    startTime?: DateTime;

    /**
     * Time at which the event will finish. Only when the `withTimingInfo` flag is set.
     */
    endTime?: DateTime;
}

/**
 * Returns an ordered list of all the public events and timeslots that have been announced thus far.
 * Optionally the `withTimingInfo` flag may be set, which will then also return time information.
 */
export async function getPublicEventsForFestival(
    festivalId: number, festivalTimezone: string, withTimingInfo?: boolean)
    : Promise<EventTimeslotEntry[]>
{
    const maxDurationMinutes =
        await readSetting('availability-max-event-duration-minutes') ?? Number.MAX_SAFE_INTEGER;

    const events: EventTimeslotEntry[] = [];
    const timeslots = await db.selectFrom(tActivities)
        .innerJoin(tActivitiesTimeslots)
            .on(tActivitiesTimeslots.activityId.equals(tActivities.activityId))
            .and(tActivitiesTimeslots.timeslotDeleted.isNull())
        .where(tActivities.activityFestivalId.equals(festivalId))
            .and(tActivities.activityType.equals(ActivityType.Program))
            .and(tActivities.activityVisible.equals(/* true= */ 1))
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

    for (const timeslot of timeslots) {
        const duration = timeslot.endTime.diff(timeslot.startTime, 'minutes');
        if (duration < 0 || duration > maxDurationMinutes)
            continue;  // this event exceeds the duration cutoff

        const localStartTime = timeslot.startTime.tz(festivalTimezone);
        const localEndTime = timeslot.endTime.tz(festivalTimezone);

        const entry: EventTimeslotEntry = {
            id: timeslot.id,
            label: `${timeslot.title} (${localStartTime.format('dddd, HH:mm')}–` +
                `${localEndTime.format('HH:mm')})`,
        };

        if (!!withTimingInfo) {
            entry.startTime = timeslot.startTime;
            entry.endTime = timeslot.endTime;
        }

        events.push(entry);
    }

    return events;
}
