// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Filters } from '../Filters';
import type { LineGraphData } from '../components/LineGraph';
import { toLineGraphData } from './toLineGraphData';
import db, { tEvents, tSchedule, tShifts, tShiftsCategories, tRoles, tTeams, tUsersEvents }
    from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Query that gathers the average number of shifts that each volunteer has helped out for, separated
 * by event and team, with data included according to the `filters`.
 */
export async function getAverageShiftsPerVolunteer(filters: Filters): Promise<LineGraphData> {
    const rolesJoin = tRoles.forUseInLeftJoin();
    const scheduleJoin = tSchedule.forUseInLeftJoin();
    const shiftsCategoriesJoin = tShiftsCategories.forUseInLeftJoin();
    const shiftsJoin = tShifts.forUseInLeftJoin();
    const usersEventsJoin = tUsersEvents.forUseInLeftJoin();

    const data = await db.selectFrom(tEvents)
        .innerJoin(tTeams)
            .on(tTeams.teamId.inIfValue(filters.teams.map(team => team.id)))
        .leftJoin(usersEventsJoin)
            .on(usersEventsJoin.eventId.equals(tEvents.eventId))
                .and(usersEventsJoin.teamId.equals(tTeams.teamId))
                .and(usersEventsJoin.registrationStatus.equals(kRegistrationStatus.Accepted))
        .leftJoin(rolesJoin)
            .on(rolesJoin.roleId.equals(usersEventsJoin.roleId))
        .leftJoin(scheduleJoin)
            .on(scheduleJoin.userId.equals(usersEventsJoin.userId))
                .and(scheduleJoin.eventId.equals(usersEventsJoin.eventId))
                .and(scheduleJoin.scheduleDeleted.isNull())
        .leftJoin(shiftsJoin)
            .on(shiftsJoin.shiftId.equals(scheduleJoin.shiftId))
        .leftJoin(shiftsCategoriesJoin)
            .on(shiftsCategoriesJoin.shiftCategoryId.equals(shiftsJoin.shiftCategoryId))
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

            hasPermissionGrant: rolesJoin.rolePermissionGrant.isNotNull(),
            hasContributionCounted:
                shiftsCategoriesJoin.shiftCategoryCountContribution.isNull().or(
                    shiftsCategoriesJoin.shiftCategoryCountContribution.equals(/* true= */ 1)),

            volunteers: db.countDistinct(usersEventsJoin.userId),
            shifts: db.sum(
                db.fragmentWithType('double', 'required').sql`
                    TIMESTAMPDIFF(MINUTE, ${scheduleJoin.scheduleTimeStart},
                                          ${scheduleJoin.scheduleTimeEnd})`
            )
        })
        .groupBy(tEvents.eventId, tTeams.teamId)
            .groupBy('hasPermissionGrant', 'hasContributionCounted')
        .orderBy(tEvents.eventStartTime)
        .executeSelectMany();

    const normalisedData = data.filter(entry => {
        // Volunteers with a permission grant (Senior and Staff-level) are excluded from this metric
        // as are scheduled shifts for tasks such as the group photo, which we don't count.
        return !entry.hasPermissionGrant && entry.hasContributionCounted;

    }).map(entry => {
        let averageHours: number = 0;
        if (entry.shifts) {
            averageHours = entry.shifts;
            averageHours /= 60;  // minutes -> hours
            averageHours /= entry.volunteers;
        }

        return {
            ...entry,
            value: averageHours,
        };
    });

    return toLineGraphData(normalisedData);
}
