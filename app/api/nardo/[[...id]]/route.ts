// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import { type DataTableEndpoints, createDataTableApi } from '../../createDataTableApi';
import { RecordLog, kLogType } from '@lib/Log';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import db, { tNardo, tUsers } from '@lib/database';

/**
 * Row model for an individual piece of advice offered by Del a Rie Advies.
 */
const kNardoRowModel = z.object({
    /**
     * Unique ID of the piece of advice. Only exposed to administrators.
     */
    id: z.number().optional(),

    /**
     * The advice as issued on behalf of Del a Rie Advies.
     */
    advice: z.string(),

    /**
     * Name of the author of this advice. Only exposed to administrators.
     */
    authorName: z.string().optional(),

    /**
     * User ID of the author of this advice. Only exposed to administrators.
     */
    authorUserId: z.number().optional(),

    /**
     * Date and time at which the advice was updated. Only exposed to administrators.
     */
    date: z.string().optional(),
});

/**
 * The Nardo API does not require any context.
 */
const kNardoContext = z.never();

/**
 * Export type definitions so that the Nardo DataTable API can be used in `callApi()`.
 */
export type NardoEndpoints = DataTableEndpoints<typeof kNardoRowModel, typeof kNardoContext>;

/**
 * Export type definition for the Nardo DataTable API's Row Model.
 */
export type NardoRowModel = z.infer<typeof kNardoRowModel>;

/**
 * The Del a Rie advies API is implemented as a regular, editable DataTable API. All operations are
 * gated on Nardo permission, and mutations will be logged as appropriate.
 */
export const { DELETE, GET, POST, PUT } = createDataTableApi(kNardoRowModel, kNardoContext, {
    accessCheck(request, action, props) {
        switch (action) {
            case 'create':
            case 'delete':
            case 'update':
                executeAccessCheck(props.authenticationContext, {
                    check: 'admin',
                    permission: 'organisation.nardo',
                });

                break

            case 'list':
                // always allowed
                break;
        }
    },

    async create(request, props) {
        const kDefaultAdvice = 'Nardo!';

        const dbInstance = db;
        const insertId = await dbInstance.insertInto(tNardo)
            .set({
                nardoAdvice: 'Nardo!',
                nardoAuthorId: props.user!.id,
                nardoAuthorDate: dbInstance.currentZonedDateTime(),
            })
            .returningLastInsertedId()
            .executeInsert();

        return {
            success: true,
            row: {
                id: insertId,
                advice: kDefaultAdvice,
                authorName: `${props.user!.firstName} ${props.user!.lastName}`,
                authorUserId: props.user!.id,
                date: Temporal.Now.zonedDateTimeISO('utc').toString(),
            },
        };
    },

    async delete({ id }, props) {
        const affectedRows = await db.update(tNardo)
            .set({
                nardoVisible: /* false= */ 0,
            })
            .where(tNardo.nardoId.equals(id))
                .and(tNardo.nardoVisible.equals(/* true= */ 1))
            .executeUpdate();

        return { success: !!affectedRows };
    },

    async list({ pagination, sort }, props) {
        const publicView = !props.access.can('organisation.nardo');

        const dbInstance = db;
        const results = await dbInstance.selectFrom(tNardo)
            .innerJoin(tUsers)
                .on(tUsers.userId.equals(tNardo.nardoAuthorId))
            .where(tNardo.nardoVisible.equals(/* true= */ 1))
            .select({
                id: tNardo.nardoId,
                advice: tNardo.nardoAdvice,
                authorName: tUsers.name,
                authorUserId: tUsers.userId,
                date: dbInstance.dateTimeAsString(tNardo.nardoAuthorDate),
            })
            .orderByFromStringIfValue(sort ? `${sort.field} ${sort.sort}` : null)
            .limit(pagination ? pagination.pageSize : 50)
                .offsetIfValue(pagination ? pagination.page * pagination.pageSize : 0)
            .executeSelectPage();

        return {
            success: true,
            rowCount: results.count,
            rows: results.data.map(result => publicView ? { advice: result.advice } : result),
        };
    },

    async update({ row }, props) {
        const affectedRows = await db.update(tNardo)
            .set({
                nardoAdvice: row.advice,
            })
            .where(tNardo.nardoId.equals(row.id))
                .and(tNardo.nardoVisible.equals(/* true= */ 1))
            .executeUpdate();

        return { success: !!affectedRows };
    },

    async writeLog(request, mutation, props) {
        RecordLog({
            type: kLogType.AdminNardoMutation,
            sourceUser: props.user!.id,
            data: { mutation },
        });
    },
});
