// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { type DataTableEndpoints, createDataTableApi } from '../../../../createDataTableApi';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { executeAccessCheck, type PermissionAccessCheck } from '@lib/auth/AuthenticationContext';
import { getShiftsForEvent } from '@app/admin/lib/getShiftsForEvent';
import { validateContext } from '../../validateContext';
import db, { tActivities, tSchedule, tShifts, tShiftsCategories } from '@lib/database';

import { kShiftDemand } from './demand';
import { kShiftDemandOverlap } from '@lib/database/Types';

/**
 * Row model for a team's shifts. The shifts are fully mutable, even though the create and edit
 * operations don't happen in a data table.
 */
const kEventShiftRowModel = z.object({
    /**
     * Unique ID of the team as it exists in the database.
     */
    id: z.number(),

    /**
     * Name of the shifts, describing what the volunteer will be doing.
     */
    name: z.string().optional(),

    /**
     * The colour that's assigned to this shift, calculated by the server.
     */
    colour: z.string(),

    /**
     * Name of the category that this shift is part of.
     */
    category: z.string(),

    /**
     * Order of the category as defined in the shift category overview.
     */
    categoryOrder: z.number(),

    /**
     * Number of minutes that this shift has been expected to schedule.
     */
    demandInMinutes: z.number().optional(),

    /**
     * Number of minutes that volunteers have been scheduled to work on this shift.
     */
    scheduledInMinutes: z.number().optional(),

    /**
     * Unique ID of the program activity with which this shift is associated.
     */
    activityId: z.number().optional(),

    /**
     * Name of the program activity with which this shift is associated.
     */
    activityName: z.string().optional(),

    /**
     * Excitement of this shift, indicated as a number between 0 and 1.
     */
    excitement: z.number(),

    // ---------------------------------------------------------------------------------------------
    // Fields only used when creating a new category, or updating an existing one:
    // ---------------------------------------------------------------------------------------------

    /**
     * Unique ID of the category in which the shift should be created.
     */
    categoryId: z.number().optional(),

    /**
     * Unique ID of the location in which the shift will be taking place.
     */
    locationId: z.number().optional(),

    /**
     * Textual description of what the shift is about. May contain Markdown.
     */
    description: z.string().optional(),

    /**
     * Demand that exists for this shift. Other fields will be ignored when provided.
     */
    demand: z.string().optional(),

    /**
     * Expected overlap between the shifts and any and all timeslots.
     */
    demandOverlap: z.enum(kShiftDemandOverlap).optional(),
});

/**
 * This API requires the event to be known.
 */
const kEventShiftContext = z.object({
    context: z.object({
        /**
         * Unique slug of the event that the request is in scope of.
         */
        event: z.string(),

        /**
         * Unique slug of the team for whom shifts are being retrieved.
         */
        team: z.string(),
    }),
});

/**
 * Export type definitions so that the API can be used in `callApi()`.
 */
export type EventShiftEndpoints =
    DataTableEndpoints<typeof kEventShiftRowModel, typeof kEventShiftContext>;

/**
 * Export type definition for the API's Row Model.
 */
export type EventShiftRowModel = z.infer<typeof kEventShiftRowModel>;

/**
 * Export type definition for the API's context.
 */
export type EventShiftContext = z.infer<typeof kEventShiftContext>;

/**
 * This is implemented as a regular DataTable API. The following endpoints are provided by this
 * implementation:
 *
 *     GET    /api/admin/event/shifts
 *     DELETE /api/admin/event/shifts/:id
 *     POST   /api/admin/event/shifts
 *     PUT    /api/admin/event/shifts/:id
 */
export const { DELETE, GET, POST, PUT } =
createDataTableApi(kEventShiftRowModel, kEventShiftContext, {
    async accessCheck({ context }, action, props) {
        const permission: PermissionAccessCheck = {
            permission: 'event.shifts',
            operation: 'read',  // to be updated
            scope: {
                event: context.event,
                team: context.team,
            },
        };

        switch (action) {
            case 'get':
            case 'list':
                permission.operation = 'read';
                break;

            case 'create':
            case 'delete':
            case 'update':
                permission.operation = action;
                break;

            default:
                throw new Error(`Unrecognised action: ${action}`);
        }

        executeAccessCheck(props.authenticationContext, permission);
    },

    async create({ context, row }) {
        const { event, team } = await validateContext(context);
        if (!event || !team)
            notFound();

        if (!row.categoryId)
            return { success: false, error: 'Please give the shift a category.' };

        const defaultExcitement = await db.selectFrom(tShiftsCategories)
            .where(tShiftsCategories.shiftCategoryId.equals(row.categoryId))
                .and(tShiftsCategories.shiftCategoryDeleted.isNull())
            .selectOneColumn(tShiftsCategories.shiftCategoryExcitement)
            .executeSelectOne();

        let insertId: number;
        if (!!row.activityId) {
            const activityName = await db.selectFrom(tActivities)
                .where(tActivities.activityId.equals(row.activityId))
                    .and(tActivities.activityFestivalId.equalsIfValue(event.festivalId))
                    .and(tActivities.activityDeleted.isNull())
                .selectOneColumn(tActivities.activityTitle)
                .executeSelectOne();

            insertId = await db.insertInto(tShifts)
                .set({
                    eventId: event.id,
                    teamId: team.id,
                    shiftCategoryId: row.categoryId,
                    shiftName: activityName,
                    shiftActivityId: row.activityId,
                    shiftExcitement: defaultExcitement,
                })
                .returningLastInsertedId()
                .executeInsert();
        } else {
            if (!row.name || !row.name.length)
                return { success: false, error: 'Please give the shift a name.' };
            if (!row.locationId)
                return { success: false, error: 'Please give the shift a location.' };

            insertId = await db.insertInto(tShifts)
                .set({
                    eventId: event.id,
                    teamId: team.id,
                    shiftCategoryId: row.categoryId,
                    shiftName: row.name,
                    shiftLocationId: row.locationId,
                    shiftExcitement: defaultExcitement,
                })
                .returningLastInsertedId()
                .executeInsert();
        }

        return {
            success: true,
            row: {
                id: insertId,
                colour: '',  // won't be used
                category: '',  // won't be used
                categoryOrder: 0,  // won't be used
                excitement: defaultExcitement,
            },
        };
    },

    async delete({ context, id }) {
        const { event, team } = await validateContext(context);
        if (!event || !team)
            notFound();

        const dbInstance = db;
        const scheduled = await dbInstance.selectFrom(tSchedule)
            .where(tSchedule.shiftId.equals(id))
                .and(tSchedule.scheduleDeleted.isNull())
            .selectCountAll()
            .executeSelectNoneOrOne();

        if (!!scheduled) {
            return {
                success: false,
                error: 'Cannot delete shifts that have been scheduled already!'
            };
        }

        const affectedRows = await dbInstance.update(tShifts)
            .set({
                shiftDeleted: dbInstance.currentZonedDateTime()
            })
            .where(tShifts.shiftId.equals(id))
                .and(tShifts.eventId.equals(event.id))
                .and(tShifts.shiftDeleted.isNull())
            .executeUpdate();

        return { success: !!affectedRows };
    },

    async list({ context, sort }) {
        const { event, team } = await validateContext(context);
        if (!event || !team)
            notFound();

        const shifts = await getShiftsForEvent(event.id, event.festivalId);
        const shiftsForTeam = shifts.filter(shift => shift.team.id === team.id);

        shiftsForTeam.sort((lhs, rhs) => {
            let mutation: number = 0;
            switch (sort?.field) {
                case 'category':
                    mutation = lhs.category.localeCompare(rhs.category);
                    break;
                case 'name':
                    mutation = lhs.name.localeCompare(rhs.name);
                    break;
                case 'demandInMinutes':
                    mutation = lhs.demandInMinutes > rhs.demandInMinutes ? 1 : -1;
                    break;
                case 'scheduledInMinutes':
                    mutation = lhs.scheduledInMinutes > rhs.scheduledInMinutes ? 1 : -1;
                    break;
            }

            return sort?.sort === 'asc' ? mutation : -mutation;
        });

        return {
            success: true,
            rowCount: shiftsForTeam.length,
            rows: shiftsForTeam.map(shift => ({
                id: shift.id,
                name: shift.name,
                colour: shift.colour,
                category: shift.category,
                categoryOrder: 0,
                demandInMinutes: shift.demandInMinutes,
                scheduledInMinutes: shift.scheduledInMinutes,
                activityId: shift.activity?.id,
                activityName: shift.activity?.name,
                description: shift.description,
                excitement: shift.excitement,
            })),
        };
    },

    async update({ context, row }, props) {
        const { event, team } = await validateContext(context);
        if (!event || !team)
            notFound();

        if (!!row.demand) {
            try {
                const jsDemand = JSON.parse(row.demand);
                kShiftDemand.parse(jsDemand);  // throws on invalid data
            } catch (error: any) {
                console.error(row.demand, error);
                return { success: false };
            }

            const affectedRows = await db.update(tShifts)
                .set({
                    shiftDemand: row.demand
                })
                .where(tShifts.shiftId.equals(row.id))
                    .and(tShifts.eventId.equals(event.id))
                    .and(tShifts.teamId.equals(team.id))
                    .and(tShifts.shiftDeleted.isNull())
                .executeUpdate();

            return { success: !!affectedRows };
        }

        if (!row.categoryId)
            return { success: false, error: 'Please give the shift a category.' };

        if (!row.activityId && !row.locationId) {
            return {
                success: false,
                error: 'Please give the shift either an activity or a location.'
            };
        }

        if (!!row.activityId && !!row.locationId)
            return { success: false, error: 'A shift cannot both have an activity and a location.' }

        if (!row.name || !row.name.length)
            return { success: false, error: 'Please give the shift a name.' };

        if (!row.excitement || row.excitement < 0 || row.excitement > 1)
            return { success: false, error: 'Please give the shift an excitement level.' };

        if (!row.demandOverlap)
            return { success: false, error: 'Please give the shift an expected timeslot overlap.' };

        const affectedRows = await db.update(tShifts)
            .set({
                shiftCategoryId: row.categoryId,
                shiftName: row.name,
                shiftActivityId: row.activityId,
                shiftLocationId: row.locationId,
                shiftColour: row.colour === '#ffffff' ? null : row.colour,
                shiftDescription: row.description || null,
                shiftDemandOverlap: row.demandOverlap,
                shiftExcitement: row.excitement,
            })
            .where(tShifts.shiftId.equals(row.id))
                .and(tShifts.eventId.equals(event.id))
                .and(tShifts.teamId.equals(team.id))
                .and(tShifts.shiftDeleted.isNull())
            .executeUpdate();

        return { success: !!affectedRows };
    },

    async writeLog({ context, id }, mutation, props) {
        const { event, team } = await validateContext(context);
        if (!event || !team)
            notFound();

        const shiftName = await db.selectFrom(tShifts)
            .where(tShifts.shiftId.equals(id))
            .selectOneColumn(tShifts.shiftName)
            .executeSelectNoneOrOne();

        RecordLog({
            type: kLogType.AdminEventShiftMutation,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            data: {
                event: event.name,
                team: team.name,
                shift: shiftName,
                mutation,
            },
        });
    },
});
