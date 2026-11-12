// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import db, { tActivities, tActivitiesTimeslots } from '@lib/database';

/**
 * Fetches the timeslots for the event identified by `festivalId` from the database.
 */
export async function getTimeslots(festivalId?: number) {
    const timeslotData = await db.selectFrom(tActivities)
        .innerJoin(tActivitiesTimeslots)
            .on(tActivitiesTimeslots.activityId.equals(tActivities.activityId))
        .where(tActivities.activityFestivalId.equals(festivalId ?? 0))
            .and(tActivities.activityDeleted.isNull())
            .and(tActivitiesTimeslots.timeslotDeleted.isNull())
        .select({
            id: tActivitiesTimeslots.timeslotId,
            start: tActivitiesTimeslots.timeslotStartTime,
            end: tActivitiesTimeslots.timeslotEndTime,
        })
        .executeSelectMany();

    return new Map(timeslotData.map(
        timeslot => [ timeslot.id, { start: timeslot.start, end: timeslot.end } ]));
}
