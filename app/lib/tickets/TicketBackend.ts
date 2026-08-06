// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Purchase, Ticket, TicketCreateRequest, TicketType } from './Types';

/**
 * The `TicketBackend` is the interface that must be implemented for each ticket service that the
 * Volunteer Manager integrates with. This abstraction layer exists in case we switch providers.
 */
export interface TicketBackend {
    /**
     * One-time initialisation of the ticket backend. Guaranteed to be called before any other API.
     */
    initialise(): Promise<void>;

    /**
     * Creates a link to the ticketing partner's overview page for the given `purchaseId`.
     */
    createPurchaseLink(purchaseId: number | string): string | undefined;

    /**
     * Creates a new ticket based on the given `request`.
     */
    createTicket(request: TicketCreateRequest): Promise<Pick<Ticket, 'purchaseId'>>;

    /**
     * Fetches the purchase identified by the given `purchaseId`.
     */
    fetchPurchase(purchaseId: number | string): Promise<Purchase | undefined>;

    /**
     * Lists the ticket types that exist for the current event.
     */
    listTicketTypes(): Promise<TicketType[]>;

    /**
     * Lists the tickets that exist for the type identified by `id`.
     */
    listTicketsForType(id: number | string): Promise<Ticket[]>;
}
