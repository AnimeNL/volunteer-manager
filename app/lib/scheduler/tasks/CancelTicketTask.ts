// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import { TaskWithParams } from '../Task';
import { createTicketService } from '@lib/tickets';
import { executeTaskNow, scheduleTask } from '@lib/scheduler';
import db, { tWeeztixTickets } from '@lib/database';

/**
 * Parameter scheme applying to the `CancelTicketTask`.
 */
const kCancelTicketTaskParamScheme = z.object({
    /**
     * Event slug used to resolve the configured ticketing provider.
     */
    event: z.string(),

    /**
     * Unique ID of the order whose tickets should be cancelled.
     */
    orderId: z.union([ z.number(), z.string().nonempty() ]),

    /**
     * Reason for cancelling the order's tickets.
     */
    reason: z.enum([ 'Cancellation', 'Manual' ]),
});

/**
 * Type definition of the parameter scheme, to be used by TypeScript.
 */
type TaskParams = z.infer<typeof kCancelTicketTaskParamScheme>;

/**
 * Task that cancels the tickets associated with an order with the event's configured ticketing
 * provider.
 */
export class CancelTicketTask extends TaskWithParams<TaskParams> {
    /**
     * Immediately cancels the ticket(s) and awaits completion, while recording full scheduler logging
     * and instrumentation. Returns whether the cancellation succeeded.
     */
    static async ExecuteNow(request: TaskParams): Promise<boolean> {
        return executeTaskNow<TaskParams>({
            taskName: 'CancelTicketTask',
            params: request,
        });
    }

    /**
     * Schedules cancellation of the ticket(s) using the task scheduler. Returns the scheduled task
     * ID.
     */
    static async Schedule(request: TaskParams, delayMs?: number): Promise<number> {
        return scheduleTask<TaskParams>({
            taskName: 'CancelTicketTask',
            params: request,
            delayMs: delayMs ?? 0,
        });
    }

    override validate(params: unknown): TaskParams | never {
        return kCancelTicketTaskParamScheme.parse(params);
    }

    override async execute(params: TaskParams): Promise<boolean> {
        const service = await createTicketService(params.event);
        if (!service) {
            this.log.error(`No ticket service configured for event "${params.event}".`);
            return false;
        }

        switch (service.id) {
            case 'Weeztix':
                return this.cancelWeeztixOrder(String(params.orderId), params);

            default:
                this.log.error(`Cancelling tickets is not supported for provider "${service.id}".`);
                return false;
        }
    }

    /**
     * Cancels the tickets associated with a Weeztix order.
     */
    private async cancelWeeztixOrder(orderGuid: string, params: TaskParams): Promise<boolean> {
        const ticketGuids = await db.selectFrom(tWeeztixTickets)
            .where(tWeeztixTickets.weeztixOrderGuid.equals(orderGuid))
                .and(tWeeztixTickets.weeztixTicketDeleted.isNull())
            .selectOneColumn(tWeeztixTickets.weeztixGuid)
            .executeSelectMany();

        if (!ticketGuids.length) {
            this.log.warning(`No active tickets found for Weeztix order ${orderGuid}.`);
            return false;
        }

        this.log.info(
            `Found ${ticketGuids.length} ticket(s) for Weeztix order ${orderGuid} ` +
            `(reason: ${params.reason}).`);

        // TODO: Cancel the order and its tickets with Weeztix.
        return true;
    }
}
