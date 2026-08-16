// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { z } from 'zod/v4';

import { LogBuilder } from '@lib/log/index';
import { executeServerAction } from '@lib/serverAction';
import { requireAuthenticationWithEventAndTeam } from '@app/admin/lib/requireAuthentication';
import { writeUserSetting } from '@lib/UserSettings';
import db, { tActivities, tShifts, tShiftsCategories } from '@lib/database';

import { kShiftDemand } from './ShiftDemandSchema';
import { kShiftDemandOverlap } from '@lib/database/Types';

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
            props.authenticationContext, eventSlug, teamSlug, {
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

/**
 * Zod schema describing the parameters required to update an existing shift.
 */
const kUpdateShiftData = z.object({
    activityId: z.number().optional(),
    categoryId: z.number(),
    locationId: z.number().optional(),
    name: z.string().optional(),
    type: z.enum([ 'program', 'initiative' ]),

    colour: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullish(),
    description: z.string().optional().nullable(),
    excitement: z.number().min(0).max(1),
    overlap: z.enum(kShiftDemandOverlap),
});

/**
 * Server Action to update an existing shift's settings.
 */
export async function updateShift(
    eventSlug: string, teamSlug: string, shiftId: number, formData: unknown)
{
    return executeServerAction(formData, kUpdateShiftData, async (data, props) => {
        const { event, team } = await requireAuthenticationWithEventAndTeam(
            props.authenticationContext, eventSlug, teamSlug, {
                permission: 'event.shifts',
                operation: 'create',
            });

        if (data.type === 'program' && !data.activityId)
            return { success: false, error: 'Please pick an activity for the shift.' };

        if (data.type === 'initiative' && !data.locationId)
            return { success: false, error: 'Please pick a location for the shift.' };

        const affectedRows = await db.update(tShifts)
            .set({
                shiftCategoryId: data.categoryId,
                shiftName: data.name,
                shiftActivityId: data.type === 'program' ? data.activityId : null,
                shiftLocationId: data.type === 'initiative' ? data.locationId : null,
                shiftColour: data.colour === '#ffffff' ? null : data.colour,
                shiftDescription: data.description || null,
                shiftDemandOverlap: data.overlap,
                shiftExcitement: data.excitement,
            })
            .where(tShifts.shiftId.equals(shiftId))
                .and(tShifts.eventId.equals(event.id))
                .and(tShifts.teamId.equals(team.id))
                .and(tShifts.shiftDeleted.isNull())
            .executeUpdate();

        LogBuilder.for('UpdateShift')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .record({
                event: event.shortName,
                team: team.title,
                shift: data.name || '(unknown)',
            });

        return { success: true };
    });
}

/**
 * Zod schema describing the parameters required to update shift volunteering demand.
 */
const kUpdateShiftDemandData = z.object({
    demand: z.array(z.object({
        start: z.iso.datetime({ offset: true }),
        end: z.iso.datetime({ offset: true }),
        volunteers: z.number().min(1),
    })),
});

/**
 * Server Action to update the volunteering demand of a shift.
 */
export async function updateShiftDemand(
    eventSlug: string, teamSlug: string, shiftId: number, formData: unknown)
{
    return executeServerAction(formData, kUpdateShiftDemandData, async (data, props) => {
        const { event, team } = await requireAuthenticationWithEventAndTeam(
            props.authenticationContext, eventSlug, teamSlug, {
                permission: 'event.shifts',
                operation: 'create',
            });

        let validatedShiftDemand: z.infer<typeof kShiftDemand>;
        try {
            validatedShiftDemand = kShiftDemand.parse(data.demand);
        } catch (_error: any) {
            return { success: false, error: 'Invalid demand format.' };
        }

        const shiftName = await db.selectFrom(tShifts)
            .where(tShifts.shiftId.equals(shiftId))
            .selectOneColumn(tShifts.shiftName)
            .executeSelectNoneOrOne();

        const affectedRows = await db.update(tShifts)
            .set({
                shiftDemand: JSON.stringify(validatedShiftDemand)
            })
            .where(tShifts.shiftId.equals(shiftId))
                .and(tShifts.eventId.equals(event.id))
                .and(tShifts.teamId.equals(team.id))
                .and(tShifts.shiftDeleted.isNull())
            .executeUpdate();

        LogBuilder.for('UpdateShiftDemand')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                event: event.shortName,
                team: team.title,
                shift: shiftName || '(unknown)',
            });

        return { success: true };
    });
}


/**
 * Server Action through which team visibility can be persisted in user settings.
 */
export async function updateTeamVisibility(input: unknown) {
    return executeServerAction(input, z.object({ visible: z.boolean() }), async (data, props) => {
        await writeUserSetting(props.user.id, 'user-admin-shifts-display-other-teams', data.visible)
        return { success: true };
    });
}
