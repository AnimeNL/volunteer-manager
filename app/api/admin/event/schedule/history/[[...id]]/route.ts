// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { type DataTableEndpoints, createDataTableApi } from '../../../../../createDataTableApi';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { getMutations } from './getMutations';
import { validateContext } from '../../../validateContext';
import db, { tScheduleLogs } from '@lib/database';

/**
 * Row model for a history entry associated with a team's schedule.
 */
const kEventScheduleHistoryRowModel = z.object({
    /**
     * Unique ID of the history entry as it exists in the database.
     */
    id: z.number(),

    /**
     * Date and time at which the mutation was made, in UTC.
     */
    date: z.string(),

    /**
     * Unique ID of the user who made this mutation.
     */
    userId: z.number(),

    /**
     * Name of the user who made this mutation. May be linked through to their profile.
     */
    user: z.string(),

    /**
     * The mutation that happened, formatted as a human readable string.
     */
    mutation: z.string(),
});

/**
 * This API is associated with a particular event and team.
 */
const kEventScheduleHistoryContext = z.object({
    context: z.object({
        /**
         * Unique slug of the event that the history should be obtained of.
         */
        event: z.string(),

        /**
         * Unique slug of the team that the history should be obtained of.
         */
        team: z.string(),

        /**
         * Optional ID of the scheduled shift for which history should be shown.
         */
        scheduleId: z.string().optional(),
    }),
});

/**
 * Export type definition for the API's Row Model.
 */
export type EventScheduleHistoryContext = z.infer<typeof kEventScheduleHistoryContext>;

/**
 * Export type definitions so that the API can be used in `callApi()`.
 */
export type EventScheduleHistoryEndpoints =
    DataTableEndpoints<typeof kEventScheduleHistoryRowModel, typeof kEventScheduleHistoryContext>;

export type { EventScheduleHistoryRowModel } from './getMutations';

/**
 * This is implemented as a regular DataTable API. The following endpoints are provided by this
 * implementation:
 *
 *     GET    /api/admin/event/schedule/history/:event/:team
 *     DELETE /api/admin/event/schedule/history/:event/:team/:id
 */
export const { DELETE, GET } =
createDataTableApi(kEventScheduleHistoryRowModel, kEventScheduleHistoryContext, {
    async accessCheck({ context }, action, props) {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin-event',
            event: context.event,
            permission: {
                permission: 'event.schedule.planning',
                operation: 'read',
                scope: {
                    event: context.event,
                    team: context.team,
                },
            },
        });

        if (action === 'delete') {
            executeAccessCheck(props.authenticationContext, {
                permission: {
                    permission: 'system.logs',
                    operation: 'delete',
                },
            });
        }
    },

    async delete({ context, id }) {
        const { event, team } = await validateContext(context);
        if (!event || !team)
            notFound();

        const affectedRows = await db.deleteFrom(tScheduleLogs)
            .where(tScheduleLogs.mutationId.equals(id))
                .and(tScheduleLogs.eventId.equals(event.id))
            .executeDelete();

        return {
            success: !!affectedRows,
        }
    },

    async list({ context, pagination }) {
        const { event, team } = await validateContext(context);
        if (!event || !team)
            notFound();

        let scheduleId: number | undefined;
        if (!!context.scheduleId)
            scheduleId = parseInt(context.scheduleId, /* radix= */ 10);

        const [ rowCount, rows ] = await getMutations(event.id, team.id, event.timezone, {
            pagination,
            scheduleId
        });

        return {
            success: true,
            rowCount, rows,
        };
    },
});
