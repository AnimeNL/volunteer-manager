// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import { Cache } from '@lib/cache';
import { TaskWithParams } from '../Task';
import { createTicketService } from '@lib/tickets';
import { createWeeztixClient } from '@lib/integrations/weeztix';
import { executeTaskNow } from '@lib/scheduler';

/**
 * Parameter scheme applying to the `UpdateTicketTask`.
 */
const kUpdateTicketTaskParamScheme = z.object({
    /**
     * Event ID or slug used to resolve the configured ticketing provider.
     */
    event: z.union([ z.number(), z.string().nonempty() ]),

    /**
     * Unique ID of the order containing the ticket to update.
     */
    orderId: z.union([ z.number(), z.string().nonempty() ]),

    /**
     * Unique ID of the ticket to update within the order.
     */
    ticketId: z.union([ z.number(), z.string().nonempty() ]),

    /**
     * Full name of the ticket holder.
     */
    name: z.string().trim().nonempty(),

    /**
     * E-mail address associated with the order receiver.
     */
    email: z.email(),

    /**
     * Function (role) to assign to the ticket holder.
     */
    function: z.string().trim().nonempty(),

    /**
     * Organisation (department) to assign to the ticket holder.
     */
    organisation: z.string().trim().nonempty(),

    /**
     * Optional nickname for the ticket holder. Omitting or passing an empty string clears any
     * existing nickname on the ticket.
     */
    nickname: z.string().trim().optional(),
});

/**
 * Type definition of the parameter scheme, to be used by TypeScript.
 */
type TaskParams = z.infer<typeof kUpdateTicketTaskParamScheme>;

/**
 * Splits a full `name` on the first whitespace separator into `firstName` and `lastName`,
 * preserving multi-word surnames (e.g. Dutch tussenvoegsels).
 */
function splitFullName(name: string): { firstName: string; lastName: string } {
    const normalised = name.replace(/\s+/g, ' ').trim();
    const separator = normalised.indexOf(' ');
    if (separator === -1)
        return { firstName: normalised, lastName: '' };

    return {
        firstName: normalised.slice(0, separator),
        lastName: normalised.slice(separator + 1),
    };
}

/**
 * Task that updates an individual ticket's holder details and owning order receiver information
 * with the event's configured ticketing provider.
 */
export class UpdateTicketTask extends TaskWithParams<TaskParams> {
    /**
     * Immediately updates the ticket and awaits completion, while recording full scheduler logging
     * and instrumentation. Returns whether the update succeeded.
     */
    static async ExecuteNow(request: TaskParams): Promise<boolean> {
        return executeTaskNow<TaskParams>({
            taskName: 'UpdateTicketTask',
            params: request,
        });
    }

    override validate(params: unknown): TaskParams | never {
        return kUpdateTicketTaskParamScheme.parse(params);
    }

    override async execute(params: TaskParams): Promise<boolean> {
        const service = await createTicketService(params.event);
        if (!service) {
            this.log.error(`No ticket service configured for event "${params.event}".`);
            return false;
        }

        switch (service.id) {
            case 'Weeztix':
                return this.updateWeeztixTicket(
                    String(params.orderId), String(params.ticketId), params);

            default:
                this.log.error(`Updating tickets is not supported for provider "${service.id}".`);
                return false;
        }
    }

    /**
     * Updates ticket metadata and order receiver information for a Weeztix ticket. Ticket metadata
     * is updated before receiver information so Weeztix's ticket PDF rebuild includes the changes.
     */
    private async updateWeeztixTicket(
        orderGuid: string, ticketGuid: string, params: TaskParams): Promise<boolean>
    {
        const client = await createWeeztixClient();

        this.log.info(`Fetching Weeztix order ${orderGuid} to resolve ticket metadata.`);
        const order = await client.getOrder(orderGuid);

        const ticket = order.tickets?.find(entry => entry.guid === ticketGuid);
        if (!ticket) {
            this.log.error(`Ticket ${ticketGuid} was not found in Weeztix order ${orderGuid}.`);
            return false;
        }

        const existingMetadata = new Map(
            (ticket.meta_data ?? []).map(entry => [ entry.metadata_id, entry ]));

        const { firstName, lastName } = splitFullName(params.name);
        const desiredMetadata: [ string, string ][] = [
            [ client.metaFirstNameId, firstName ],
            [ client.metaLastNameId, lastName ],
            [ client.metaFunctionId, params.function ],
            [ client.metaOrganisationId, params.organisation ],
            [ client.metaNicknameId, params.nickname ?? '' ],
        ];

        for (const [ metadataId, desiredValue ] of desiredMetadata) {
            const existing = existingMetadata.get(metadataId);
            const currentValue = existing?.value != null ? String(existing.value) : '';

            if (existing) {
                if (currentValue === desiredValue)
                    continue;

                await client.updateOrderTicketMetadata(orderGuid, ticketGuid, existing.guid, {
                    value: desiredValue,
                });
            } else if (desiredValue.length > 0) {
                await client.createOrderTicketMetadata(orderGuid, ticketGuid, {
                    metadata_id: metadataId,
                    value: desiredValue,
                });
            }
        }

        this.log.info(`Updating receiver information for Weeztix order ${orderGuid}.`);
        const updatedOrder = await client.updateOrderReceiver(orderGuid, {
            email: params.email,
            firstName,
            lastName,
        });

        Cache.getInstance('TicketProvider').set(`weeztix/order/${orderGuid}`, {
            order: {
                email: updatedOrder.email?.trim() || params.email,
            },
        });

        return true;
    }
}
