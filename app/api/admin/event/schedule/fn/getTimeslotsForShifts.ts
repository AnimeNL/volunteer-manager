// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import db, { tActivities, tActivitiesTimeslots, tShifts } from '@lib/database';

import { kShiftDemand } from '../../shifts/[[...id]]/demand';

/**
 * Fetches the timeslots for the given `shiftIds` from the database.
 */
export async function getTimeslotsForShifts(shiftIds: number[]) {
    const activitiesJoin = tActivities.forUseInLeftJoin();
    const activitiesTimeslotsJoin = tActivitiesTimeslots.forUseInLeftJoin();

    const dbInstance = db;
    const shifts = await dbInstance.selectFrom(tShifts)
        .leftJoin(activitiesJoin)
            .on(activitiesJoin.activityId.equals(tShifts.shiftActivityId))
        .leftJoin(activitiesTimeslotsJoin)
            .on(activitiesTimeslotsJoin.activityId.equals(activitiesJoin.activityId))
        .where(tShifts.shiftId.in(shiftIds))
            .and(tShifts.shiftDeleted.isNull())
        .select({
            id: tShifts.shiftId,
            demand: tShifts.shiftDemand,
            timeslots: dbInstance.aggregateAsArray({
                start: activitiesTimeslotsJoin.timeslotStartTime,
                end: activitiesTimeslotsJoin.timeslotEndTime,
            }),
        })
        .groupBy(tShifts.shiftId, tShifts.shiftActivityId)
        .executeSelectMany();

    return shifts.map(shift => {
        let demand;
        if (!!shift.demand) {
            try {
                const demandObj = JSON.parse(shift.demand);
                const demandParsed = kShiftDemand.safeParse(demandObj);

                if (demandParsed.success)
                    demand = demandParsed.data;

            } catch (error: any) {
                console.warn('Unable to parse shift demand:', shift.demand, error);
            }
        }

        return {
            ...shift,
            demand,
        };
    });
}
