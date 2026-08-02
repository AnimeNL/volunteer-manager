// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Ticket, TicketCreateRequest, TicketType } from '../Types';
import type { TicketBackend } from '../TicketBackend';
import { type WeeztixClient, createWeeztixClient } from '@app/lib/integrations/weeztix';

/**
 * Implementation of the `TicketBackend` specific to Weeztix.
 * @see https://docs.weeztix.com/api/dashboard/dashboard
 */
export class Weeztix implements TicketBackend {
    #client: WeeztixClient | undefined;
    #eventGuid: string;

    constructor(eventGuid: string) {
        this.#eventGuid = eventGuid;
    }

    // ---------------------------------------------------------------------------------------------
    // TicketBackend implementation:
    // ---------------------------------------------------------------------------------------------

    async initialise(): Promise<void> {
        this.#client = await createWeeztixClient();
    }

    async createTicket(request: TicketCreateRequest): Promise<Ticket | undefined> {
        if (!this.#client)
            throw new Error('Unable to execute createTicket() without a valid client');

        const ticket = await this.#client.createTicket(this.#eventGuid, {
            // TODO
        });

        console.log(ticket);

        return undefined;
    }

    async listTicketTypes(): Promise<TicketType[]> {
        if (!this.#client)
            throw new Error('Unable to execute listTicketTypes() without a valid client');

        const tickets = await this.#client.listTicketTypes(this.#eventGuid);
        return tickets.map(type => ({
            id: type.guid,
            name: type.name,
            price: type.min_price,
            active: true,
        }));
    }

    async listTicketsForType(id: number | string): Promise<Ticket[]> {
        if (!this.#client)
            throw new Error('Unable to execute listTicketsForType() without a valid client');

        const tickets = await this.#client.listTicketsForType(this.#eventGuid, id.toString());
        console.log(tickets);

        return tickets.map(ticket => ({
            // TODO
        } as any));
    }
}
