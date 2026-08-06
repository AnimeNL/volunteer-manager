// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Purchase, Ticket, TicketCreateRequest, TicketType } from './Types';
import type { TicketBackend } from './TicketBackend';

/**
 * The `TicketService` is the primary API through which event tickets can be managed, for example to
 * automatically manage tickets for our volunteers. It's backed by a `TicketBackend` implementation
 * that knows how to integrate with a particular ticket provider.
 */
export class TicketService {
    #backend: TicketBackend;

    constructor(backend: TicketBackend) {
        this.#backend = backend;
    }

    /**
     * Creates a link to the ticketing partner's overview page for the given `purchaseId`.
     */
    createPurchaseLink(purchaseId: number | string): string | undefined {
        return this.#backend.createPurchaseLink(purchaseId);
    }

    /**
     * Creates a new ticket based on the given `request`. This may end up calling multiple APIs
     * depending on requirements of the chosen ticketing partner. Ticket creation may fail for a
     * variety of reasons, largely outside of our control.
     */
    async createTicket(request: TicketCreateRequest): Promise<Pick<Ticket, 'purchaseId'>> {
        return this.#backend.createTicket(request);
    }

    /**
     * Fetches the purchase identified by the given `purchaseId`.
     */
    async fetchPurchase(purchaseId: number | string): Promise<Purchase | undefined> {
        return this.#backend.fetchPurchase(purchaseId);
    }

    /**
     * Lists the ticket types that exist for the current event.
     */
    async listTicketTypes(): Promise<TicketType[]> {
        return this.#backend.listTicketTypes();
    }

    /**
     * Lists the tickets issued for the type with the given `id`.
     */
    async listTicketsForType(id: number | string) {
        return this.#backend.listTicketsForType(id);
    }
}
