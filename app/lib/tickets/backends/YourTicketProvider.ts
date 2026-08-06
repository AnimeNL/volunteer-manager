// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Purchase, Ticket, TicketCreateRequest, TicketType } from '../Types';
import type { TicketBackend } from '../TicketBackend';
import { type YourTicketProviderClient, createYourTicketProviderClient }
    from '@app/lib/integrations/yourticketprovider';

import db, { tYourTicketProviderPurchases, tYourTicketProviderTickets } from '@lib/database';

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

    createPurchaseLink(purchaseId: number | string): string | undefined {
        const baseUrl = 'https://www.yourticketprovider.nl/account/events/manage/guests';
        return `${baseUrl}/purchaseitems.aspx?y=${this.#eventId}&purchaseid=${purchaseId}`;
    }

    async createTicket(request: TicketCreateRequest): Promise<Pick<Ticket, 'purchaseId'>> {
        if (!this.#client)
            throw new Error('Unable to execute createTicket() without a valid client');

        const ticket = await this.#client.createTicket(this.#eventId, {
            EventId: this.#eventId,
            Email: request.emailAddress,
            IncludeTicketGuarantee: false,
            Language: 'en',
            Complimentary: true,
            HasAcceptedTermsAndAgreements: true,
            PurchaseItems: [
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

        return { purchaseId: ticket.Id };
    }

    async fetchPurchase(purchaseId: number | string): Promise<Purchase | undefined> {
        const dbInstance = db;

        const yourTicketProviderTicketsJoin = tYourTicketProviderTickets.forUseInLeftJoin();

        return await dbInstance.selectFrom(tYourTicketProviderPurchases)
            .leftJoin(yourTicketProviderTicketsJoin)
                .on(yourTicketProviderTicketsJoin.ytpTicketId.equals(
                    tYourTicketProviderPurchases.ytpPurchaseItemTicketId))
            .where(tYourTicketProviderPurchases.ytpPurchaseId.equals(Number(purchaseId)))
            .select({
                id: tYourTicketProviderPurchases.ytpPurchaseId,
                eventId: tYourTicketProviderPurchases.ytpPurchaseEventId,
                cancelled: tYourTicketProviderPurchases.ytpPurchaseDateCancelled,
                paid: tYourTicketProviderPurchases.ytpPurchaseDatePaid,
                tickets: dbInstance.aggregateAsArray({
                    id: tYourTicketProviderPurchases.ytpPurchaseItemId,
                    ticketId: tYourTicketProviderPurchases.ytpPurchaseItemTicketId,
                    ticketName: yourTicketProviderTicketsJoin.ytpTicketName,
                    barcode: tYourTicketProviderPurchases.ytpPurchaseItemBarcode,
                    holder: tYourTicketProviderPurchases.ytpPurchaseItemHolder,
                }),
            })
            .groupBy(tYourTicketProviderPurchases.ytpPurchaseId)
            .executeSelectNoneOrOne() ?? undefined;
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

    async listTicketsForType(ticketId: number | string): Promise<Ticket[]> {
        return db.selectFrom(tYourTicketProviderPurchases)
            .where(tYourTicketProviderPurchases.ytpPurchaseEventId.equals(this.#eventId))
                .and(tYourTicketProviderPurchases.ytpPurchaseItemTicketId.equals(Number(ticketId)))
            .select({
                id: tYourTicketProviderPurchases.ytpPurchaseItemId,
                purchaseId: tYourTicketProviderPurchases.ytpPurchaseId,
                ticketId: tYourTicketProviderPurchases.ytpPurchaseItemTicketId,
                barcode: tYourTicketProviderPurchases.ytpPurchaseItemBarcode,
                holder: tYourTicketProviderPurchases.ytpPurchaseItemHolder,
                cancelled: tYourTicketProviderPurchases.ytpPurchaseDateCancelled,
                paid: tYourTicketProviderPurchases.ytpPurchaseDatePaid,
            })
            .executeSelectMany();
    }
}
