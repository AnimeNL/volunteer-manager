// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { z } from 'zod/v4';

import { LogBuilder } from '@lib/log/index';
import { executeServerAction } from '@lib/serverAction';
import { requireAuthenticationWithEventAndTeam } from '../../requireAuthenticationWithEventAndTeam';
import db, { tActivities, tShifts, tShiftsCategories } from '@lib/database';

/**
 * Zod schema describing the parameters required to create a new shift.
 */
const kCreateShiftData = z.object({
    activityId: z.number().optional(),
    categoryId: z.number(),
    locationId: z.number().optional(),
    name: z.string().optional(),
    type: z.enum([ 'program', 'initiative' ]),
});

/**
 * Server Action to create a new shift.
 */
export async function createShift(eventSlug: string, teamSlug: string, formData: unknown) {
    return executeServerAction(formData, kCreateShiftData, async (data, props) => {
        const { event, team } = await requireAuthenticationWithEventAndTeam(
            eventSlug, teamSlug, props.authenticationContext, {
                permission: 'event.shifts',
                operation: 'create',
            });

        let shiftLocationId: number | undefined;
        let shiftName: string;

        const defaultExcitement = await db.selectFrom(tShiftsCategories)
            .where(tShiftsCategories.shiftCategoryId.equals(data.categoryId))
                .and(tShiftsCategories.shiftCategoryDeleted.isNull())
            .selectOneColumn(tShiftsCategories.shiftCategoryExcitement)
            .executeSelectOne();

        if (data.type === 'program') {
            if (!data.activityId)
                return { success: false, error: 'Please pick an activity for the shift.' };

            shiftName = await db.selectFrom(tActivities)
                .where(tActivities.activityId.equals(data.activityId))
                    .and(tActivities.activityFestivalId.equalsIfValue(
                        event.integrations?.anPlanFestivalId))
                    .and(tActivities.activityDeleted.isNull())
                .selectOneColumn(tActivities.activityTitle)
                .executeSelectOne();

        } else {
            if (!data.name || !data.name.length)
                return { success: false, error: 'Please give the shift a name.' };
            if (!data.locationId)
                return { success: false, error: 'Please give the shift a location.' };

            shiftLocationId = data.locationId;
            shiftName = data.name;
        }

        const insertId = await db.insertInto(tShifts)
            .set({
                eventId: event.id,
                teamId: team.id,
                shiftCategoryId: data.categoryId,
                shiftName,
                shiftActivityId: data.activityId,
                shiftExcitement: defaultExcitement,
                shiftLocationId,
            })
            .returningLastInsertedId()
            .executeInsert();

        LogBuilder.for('CreateShift')
            .withCondition(!!insertId)
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                event: event.shortName,
                team: team.title,
                shift: shiftName,
            });

        return {
            success: true,
            redirect: `./shifts/${insertId}`,
        };
    });
}
