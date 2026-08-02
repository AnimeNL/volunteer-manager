// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Ticket, TicketCreateRequest, TicketType } from '../Types';
import type { TicketBackend } from '../TicketBackend';
import { type YourTicketProviderClient, createYourTicketProviderClient }
    from '@app/lib/integrations/yourticketprovider';

/**
 * Implementation of the `TicketBackend` specific to YourTicketProvider and/or CM.com.
 * @see https://ytpstorage1.blob.core.windows.net/media/YTP%20Ticketing%20API%20Specifications.pdf
 */
export class YourTicketProvider implements TicketBackend {
    #client: YourTicketProviderClient | undefined;
    #eventId: number;

    constructor(eventId: number) {
        this.#eventId = eventId;
    }

    // ---------------------------------------------------------------------------------------------
    // TicketBackend implementation:
    // ---------------------------------------------------------------------------------------------

    async initialise(): Promise<void> {
        this.#client = await createYourTicketProviderClient();
    }

    async createTicket(request: TicketCreateRequest): Promise<Ticket | undefined> {
        if (!this.#client)
            throw new Error('Unable to execute createTicket() without a valid client');

        const ticket = await this.#client.createTicket(this.#eventId, {
            EventId: this.#eventId,
            Email: request.emailAddress,
            Language: 'en',
            Complimentary: true,
            HasAcceptedTermsAndAgreements: true,
            PurchasedItems: [
                {
                    TicketId: Number(request.type),
                    TicketHolderEmail: request.emailAddress,
                    TicketHolderFirstname: request.firstName,
                    TicketHolderLastname: request.lastName,
                    // TODO: TicketHolderOrganisation
                    // TODO: TicketHolderDepartment
                    // TODO: TicketHolderPosition
                }
            ],
        });

        console.log(ticket);

        return undefined;
    }

    async listTicketTypes(): Promise<TicketType[]> {
        if (!this.#client)
            throw new Error('Unable to execute listTicketTypes() without a valid client');

        const types = await this.#client.listTicketsAndProducts(this.#eventId);
        const tickets = types.filter(type => !type.IsSubproduct);

        return tickets.map(type => ({
            id: type.Id,
            name: type.Name,
            price: type.Price,
            active: type.Live,
        }));
    }

    async listTicketsForType(id: number | string): Promise<Ticket[]> {
        if (!this.#client)
            throw new Error('Unable to execute listTicketsForType() without a valid client');

        const tickets = await this.#client.listTicketsForType(this.#eventId, Number(id));
        console.log(tickets);

        return tickets.map(ticket => ({
            // TODO
        } as any));
    }
}
