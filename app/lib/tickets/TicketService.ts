// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { EventTicketCategory, EventTicketProvider } from '@lib/database/Types';
import type { ProviderProduct, ProviderProductSales, Purchase, Ticket, TicketConfiguration,
    TicketCreateRequest, TicketFinancialSummary, TicketSearchRequest, TicketSearchResults,
    TicketStatistics, TicketType, VolunteerTicket } from './Types';

/**
 * The `TicketService` is the interface that must be implemented for each ticket service that the
 * Volunteer Manager integrates with. This abstraction layer exists in case we switch providers.
 */
export interface TicketService {
    /**
     * ID of the ticket provider this backend implements.
     */
    get id(): EventTicketProvider;

    /**
     * ID of the event for which the service has been created.
     */
    get eventId(): number | string;

    /**
     * Anonymizes personally identifiable information stored for non-complimentary visitor tickets
     * for this event. Returns the number of database rows affected.
     */
    anonymizeTickets(): Promise<number>;

    /**
     * Returns whether this ticket service supports cancelling purchases.
     */
    canCancelPurchases(): boolean;

    /**
     * Returns whether this ticket service supports creating new tickets.
     */
    canCreateTickets(): boolean;

    /**
     * Cancels the purchase identified by the given `purchaseId`.
     */
    cancelPurchase(purchaseId: number | string): Promise<void>;

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
     * Fetches categorised financial products and their daily sale counts for the given `eventId`.
     */
    fetchFinancialProducts(eventId: number): Promise<ProviderProduct[]>;

    /**
     * Fetches daily sale counts for the given `productIds` in `eventId`.
     */
    fetchProductSales(eventId: number, productIds: number[]): Promise<ProviderProductSales[]>;

    /**
     * Formats the given |purchaseId| in a manner that it can be presented to visitors.
     */
    formatPurchaseId(purchaseId: number | string): string;

    /**
     * Returns the financial summary (most recent update timestamp and pending categorisation count)
     * for the given `eventId`.
     */
    getFinancialSummary(eventId: number): Promise<TicketFinancialSummary>;

    /**
     * Returns statistics on tickets sales in the current event.
     */
    getStatistics(): Promise<TicketStatistics | undefined>;

    /**
     * Returns whether any valid, settled sales have been recorded for the current event.
     */
    hasSales(): Promise<boolean>;

    /**
     * Imports the purchase identified by `purchaseId` into the local database cache, if required.
     */
    importPurchase(purchaseId: number | string): Promise<void>;

    /**
     * Lists the ticket configurations that exist for the given `eventId`.
     */
    listTicketConfigurations(eventId: number): Promise<TicketConfiguration[]>;

    /**
     * Lists the ticket types that exist for the current event.
     */
    listTicketTypes(): Promise<TicketType[]>;

    /**
     * Lists the tickets that exist for the type identified by `id`.
     */
    listTicketsForType(id: number | string): Promise<Ticket[]>;

    /**
     * Lists volunteer ticket statuses for `eventId` (optionally filtered to `userIds`), keyed by
     * user ID.
     */
    listVolunteerTickets(
        eventId: number, userIds?: number[]): Promise<Map<number, VolunteerTicket>>;

    /**
     * Searches for tickets matching the given `request`.
     */
    searchTickets(request: TicketSearchRequest): Promise<TicketSearchResults>;

    /**
     * Sends a purchase confirmation for the given `purchaseId` to the associated e-mail address.
     */
    sendPurchaseConfirmation(purchaseId: number | string): Promise<boolean>;

    /**
     * Creates or updates the configuration for `ticketTypeId` in `eventId`. Returns whether any
     * database row was affected.
     */
    upsertTicketConfiguration(
        eventId: number,
        ticketTypeId: number | string,
        config: { activityId: number | null; category: EventTicketCategory | null }): Promise<boolean>;
}
