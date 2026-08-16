// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { type DataTableEndpoints, createDataTableApi } from '../../../createDataTableApi';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { getEventBySlug } from '@lib/EventLoader';
import db, { tRefunds, tTeams, tUsers, tUsersEvents } from '@lib/database';

/**
 * Row model for a refund request, as can be shown or edited through the administration panel.
 */
const kRefundRequestRowModel = z.object({
    /**
     * Unique ID of the user who requested a refund.
     */
    id: z.number(),

    /**
     * Name of the volunteer who requested a refund.
     */
    name: z.string(),

    /**
     * Optional team slug of the requester, used to linkify their entry.
     */
    team: z.string().optional(),

    /**
     * Ticket number the volunteer purchased, which should be refunded.
     */
    ticketNumber: z.string().optional(),

    /**
     * IBAN of the account to which the refund should be issued.
     */
    accountIban: z.string(),

    /**
     * Name on the account to which the refund should be issued.
     */
    accountName: z.string(),

    /**
     * Full ISO date and time on which the refund had been requested.
     */
    requested: z.string(),

    /**
     * Whether the refund has been confirmed.
     */
    confirmed: z.boolean(),
});

/**
 * Context required by the Refund Request API.
 */
const kRefundRequestContext = z.object({
    context: z.object({
        /**
         * Unique slug of the event refund request should be considered for.
         */
        event: z.string(),
    }),
});

/**
 * Export type definitions so that the Refund Request DataTable API can be used in `callApi()`.
 */
export type RefundRequestEndpoints =
    DataTableEndpoints<typeof kRefundRequestRowModel, typeof kRefundRequestContext>;

/**
 * Export type definition for the Refund Request DataTable API's Row Model.
 */
export type RefundRequestRowModel = z.infer<typeof kRefundRequestRowModel>;

/**
 * Scope expected by the Refund Request API.
 */
export type RefundRequestScope = z.infer<typeof kRefundRequestContext>['context'];

/**
 * Implementation of the Refund Request API, which enables administrators with sufficient
 * permissions to list and update volunteer refund requests for a particular event.
 *
 * The following endpoints are provided by this implementation:
 *
 *     GET /api/admin/refunds
 *     PUT /api/admin/refunds/:id
 */
export const { PUT, GET } = createDataTableApi(kRefundRequestRowModel, kRefundRequestContext, {
    async accessCheck({ context }, action, props) {
        executeAccessCheck(props.authenticationContext, {
            permission: 'event.refunds',
            scope: {
                event: context.event,
            },
        });
    },

    async list({ context }) {
        const event = await getEventBySlug(context.event);
        if (!event)
            notFound();

        const dbInstance = db;
        const refunds = await dbInstance.selectFrom(tRefunds)
            .innerJoin(tUsersEvents)
                .on(tUsersEvents.eventId.equals(tRefunds.eventId))
                .and(tUsersEvents.userId.equals(tRefunds.userId))
            .innerJoin(tTeams)
                .on(tTeams.teamId.equals(tUsersEvents.teamId))
            .innerJoin(tUsers)
                .on(tUsers.userId.equals(tRefunds.userId))
            .select({
                id: tRefunds.userId,
                name: tUsers.name,
                team: tTeams.teamSlug,
                ticketNumber: tRefunds.refundTicketNumber,
                accountIban: tRefunds.refundAccountIban,
                accountName: tRefunds.refundAccountName,
                requested: dbInstance.dateTimeAsString(tRefunds.refundRequested),
                confirmed: tRefunds.refundConfirmed.isNotNull(),
            })
            .where(tRefunds.eventId.equals(event.eventId))
            .orderBy('confirmed', 'asc')
            .orderBy('name', 'asc')
            .executeSelectPage();

        return {
            success: true,
            rowCount: refunds.count,
            rows: refunds.data,
        };
    },

    async update({ context, id, row }, props) {
        const event = await getEventBySlug(context.event);
        if (!event)
            notFound();

        const dbInstance = db;
        const affectedRows = await dbInstance.update(tRefunds)
            .set({
                refundConfirmed: row.confirmed ? dbInstance.currentZonedDateTime() : null
            })
            .where(tRefunds.eventId.equals(event.eventId))
                .and(tRefunds.userId.equals(id))
            .executeUpdate();

        return { success: !!affectedRows };
    },

    async writeLog({ context, id }, mutation, props) {
        const event = await getEventBySlug(context.event);
        RecordLog({
            type: kLogType.AdminRefundMutation,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            targetUser: id,
            data: {
                event: event?.shortName,
            },
        });
    },
});
