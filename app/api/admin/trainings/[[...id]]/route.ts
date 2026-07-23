// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { type DataTableEndpoints, createDataTableApi } from '@app/api/createDataTableApi';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { getEventBySlug } from '@lib/EventLoader';
import db, { tTrainings } from '@lib/database';

/**
 * Row model for training entry, as can be shown and modified in the administration area.
 */
const kTrainingRowModel = z.object({
/**
     * Unique ID of this entry in the training configuration.
     */
    id: z.number(),

    /**
     * Address at which the training will be taking place.
     */
    address: z.string().optional(),

    /**
     * Maximum capacity of the training.
     */
    capacity: z.number(),

    /**
     * Date and time at which the training will commence, shared in UTC.
     */
    start: z.string(),

    /**
     * Date and time at which the training will conclude, shared in UTC.
     */
    end: z.string(),
});

/**
 * Context required for the Training API.
 */
const kTrainingContext = z.object({
    context: z.object({
        /**
         * Unique slug of the training is in scope of.
         */
        event: z.string(),
    }),
});

/**
 * Enable use of the Training API in `callApi()`.
 */
export type TrainingsEndpoints =
    DataTableEndpoints<typeof kTrainingRowModel, typeof kTrainingContext>;

/**
 * Row model expected by the Training API.
 */
export type TrainingsRowModel = z.infer<typeof kTrainingRowModel>;

/**
 * Implementation of the Training API.
 *
 * The following endpoints are provided by this implementation:
 *
 *     GET    /api/admin/trainings
 *     POST   /api/admin/trainings
 *     DELETE /api/admin/trainings/:id
 *     PUT    /api/admin/trainings/:id
 */
export const { DELETE, POST, PUT, GET } = createDataTableApi(kTrainingRowModel, kTrainingContext, {
    async accessCheck({ context }, action, props) {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin-event',
            event: context.event,
            permission: {
                permission: 'event.trainings',
                scope: {
                    event: context.event,
                },
            },
        });
    },

    async create({ context }) {
        const event = await getEventBySlug(context.event);
        if (!event)
            notFound();

        const insertId =
            await db.insertInto(tTrainings)
                .set({
                    eventId: event.eventId,
                    trainingStart: event.temporalStartTime,
                    trainingEnd: event.temporalEndTime,
                })
                .returningLastInsertedId()
                .executeInsert();

        return {
            success: true,
            row: {
                id: insertId,
                capacity: 15,
                start: event.startTime,
                end: event.endTime,
            },
        };
    },

    async delete({ context, id }) {
        const event = await getEventBySlug(context.event);
        if (!event)
            notFound();

        const affectedRows =
            await db.deleteFrom(tTrainings)
                .where(tTrainings.trainingId.equals(id))
                    .and(tTrainings.eventId.equals(event.eventId))
                .executeDelete(/* min= */ 0, /* max= */ 1);

        return { success: !!affectedRows };
    },

    async list({ context, pagination, sort }) {
        const event = await getEventBySlug(context.event);
        if (!event)
            notFound();

        const dbInstance = db;
        const trainings = await dbInstance.selectFrom(tTrainings)
            .where(tTrainings.eventId.equals(event.id))
                .and(tTrainings.trainingVisible.equals(/* true= */ 1))
            .select({
                id: tTrainings.trainingId,
                address: tTrainings.trainingAddress,
                capacity: tTrainings.trainingCapacity,
                start: dbInstance.dateTimeAsString(tTrainings.trainingStart),
                end: dbInstance.dateTimeAsString(tTrainings.trainingEnd),
            })
            .orderBy(sort?.field ?? 'start', sort?.sort ?? 'asc')
            .limitIfValue(pagination ? pagination.pageSize : null)
                .offsetIfValue(pagination ? pagination.page * pagination.pageSize : null)
            .executeSelectPage();

        return {
            success: true,
            rowCount: trainings.count,
            rows: trainings.data,
        };
    },

    async update({ context, id, row }) {
        const event = await getEventBySlug(context.event);
        if (!event)
            notFound();

        const affectedRows = await db.update(tTrainings)
            .set({
                trainingAddress: row.address,
                trainingCapacity: row.capacity,
                trainingStart: Temporal.Instant.from(row.start).toZonedDateTimeISO('UTC'),
                trainingEnd: Temporal.Instant.from(row.end).toZonedDateTimeISO('UTC'),
            })
            .where(tTrainings.trainingId.equals(id))
                .and(tTrainings.eventId.equals(event.eventId))
            .executeUpdate(/* min= */ 0, /* max= */ 1);

        return { success: !!affectedRows };
    },

    async writeLog({ context }, mutation, props) {
        const event = await getEventBySlug(context.event);
        RecordLog({
            type: kLogType.AdminEventTrainingMutation,
            severity: kLogSeverity.Info,
            sourceUser: props.user,
            data: {
                eventName: event!.shortName,
                mutation: mutation,
            },
        });
    },
});
