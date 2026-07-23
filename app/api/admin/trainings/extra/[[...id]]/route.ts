// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { type DataTableEndpoints, createDataTableApi } from '@app/api/createDataTableApi';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { getEventBySlug } from '@lib/EventLoader';
import db, { tTrainingsAssignments, tTrainingsExtra } from '@lib/database';

/**
 * Row model for training extra, as can be shown and modified in the administration area.
 */
const kTrainingExtraRowModel = z.object({
    /**
     * Unique ID of this entry in the training configuration.
     */
    id: z.number(),

    /**
     * Name of the participant who would like to join.
     */
    trainingExtraName: z.string().optional(),

    /**
     * E-mail address of the participant who would like to join.
     */
    trainingExtraEmail: z.string().optional(),

    /**
     * Date of birth of the participant, which we need for certification purposes.
     */
    trainingExtraBirthdate: z.string().optional(),

    /**
     * Preferred training session that this volunteer would like to participate in, if any.
     */
    preferenceTrainingId: z.number().optional(),

    /**
     * Date on which the preference was updated, if any.
     */
    preferenceUpdated: z.string().optional(),
});

/**
 * Context required for the API.
 */
const kTrainingExtraContext = z.object({
    context: z.object({
        /**
         * Unique slug of the training is in scope of.
         */
        event: z.string(),
    }),
});

/**
 * Enable use of the Training Extra API in `callApi()`.
 */
export type TrainingsExtraEndpoints =
    DataTableEndpoints<typeof kTrainingExtraRowModel, typeof kTrainingExtraContext>;

/**
 * Row model expected by the Training API.
 */
export type TrainingsExtraRowModel = z.infer<typeof kTrainingExtraRowModel>;

/**
 * Implementation of the Training API.
 *
 * The following endpoints are provided by this implementation:
 *
 *     GET    /api/admin/trainings/extra
 *     POST   /api/admin/trainings/extra
 *     DELETE /api/admin/trainings/extra/:id
 *     PUT    /api/admin/trainings/extra/:id
 */
export const { DELETE, POST, PUT, GET } =
createDataTableApi(kTrainingExtraRowModel, kTrainingExtraContext, {
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

        const insertId = await db.insertInto(tTrainingsExtra)
            .set({
                eventId: event.id
            })
            .returningLastInsertedId()
            .executeInsert();

        return {
            success: true,
            row: {
                id: insertId,
            },
        };
    },

    async delete({ context, id }) {
        const event = await getEventBySlug(context.event);
        if (!event)
            notFound();

        const affectedRows = await db.deleteFrom(tTrainingsExtra)
            .where(tTrainingsExtra.trainingExtraId.equals(id))
                .and(tTrainingsExtra.eventId.equals(event.id))
            .executeDelete();

        return { success: !!affectedRows };
    },

    async list({ context, sort }) {
        const event = await getEventBySlug(context.event);
        if (!event)
            notFound();

        const trainingsAssignmentsJoin = tTrainingsAssignments.forUseInLeftJoin();

        const dbInstance = db;
        const results = await dbInstance.selectFrom(tTrainingsExtra)
            .leftJoin(trainingsAssignmentsJoin)
                .on(trainingsAssignmentsJoin.eventId.equals(tTrainingsExtra.eventId))
                .and(trainingsAssignmentsJoin.assignmentExtraId.equals(
                    tTrainingsExtra.trainingExtraId))
            .where(tTrainingsExtra.eventId.equals(event.id))
                .and(tTrainingsExtra.trainingExtraVisible.equals(/* true= */ 1))
            .select({
                id: tTrainingsExtra.trainingExtraId,
                trainingExtraName: tTrainingsExtra.trainingExtraName,
                trainingExtraEmail: tTrainingsExtra.trainingExtraEmail,
                trainingExtraBirthdate:
                    dbInstance.dateAsString(tTrainingsExtra.trainingExtraBirthdate),
                preferenceTrainingId: trainingsAssignmentsJoin.preferenceTrainingId,
                preferenceUpdated:
                    dbInstance.dateTimeAsString(trainingsAssignmentsJoin.preferenceUpdated),
            })
            .orderBy(sort?.field ?? 'trainingExtraName', sort?.sort ?? 'asc')
            .executeSelectMany();

        return {
            success: true,
            rowCount: results.length,
            rows: results,
        };
    },

    async update({ context, id, row }) {
        const event = await getEventBySlug(context.event);
        if (!event)
            notFound();

        const dbInstance = db;
        const affectedRows = await dbInstance.transaction(async () => {
            const affectedRows = await dbInstance.update(tTrainingsExtra)
                .set({
                    trainingExtraName: row.trainingExtraName,
                    trainingExtraEmail: row.trainingExtraEmail,
                    trainingExtraBirthdate: !!row.trainingExtraBirthdate
                        ? Temporal.PlainDate.from(row.trainingExtraBirthdate)
                        : null,
                })
                .where(tTrainingsExtra.trainingExtraId.equals(row.id))
                    .and(tTrainingsExtra.eventId.equals(event.id))
                .executeUpdate();

            if (row.preferenceTrainingId !== undefined) {
                const preferenceTrainingId =
                    row.preferenceTrainingId === 0 ? null
                                                   : row.preferenceTrainingId;

                await dbInstance.insertInto(tTrainingsAssignments)
                    .set({
                        eventId: event.id,
                        assignmentExtraId: row.id,
                        preferenceTrainingId,
                        preferenceUpdated: dbInstance.currentZonedDateTime(),
                    })
                    .onConflictDoUpdateSet({
                        preferenceTrainingId,
                        preferenceUpdated: dbInstance.currentZonedDateTime(),
                    })
                    .executeInsert();
            }

            return affectedRows;
        });

        return { success: !!affectedRows };
    },

    async writeLog({ context }, mutation, props) {
        const event = await getEventBySlug(context.event);
        if (!event)
            return;

        RecordLog({
            type: kLogType.AdminEventTrainingExtraMutation,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            data: {
                eventName: event!.shortName,
                mutation,
            },
        });
    },
});
