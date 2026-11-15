// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { EventTicketCategory } from '@lib/database/Types';

/**
 * Interface that describes a singular purchase, that may contain multiple individual tickets.
 */
export interface Purchase {
    /**
     * Unique ID of the purchase.
     */
    id: number | string;

    /**
     * Unique ID of the event that the purchase was made for.
     */
    eventId: number | string;

    /**
     * Date on which the purchase has been cancelled, if any.
     */
    cancelled?: Temporal.ZonedDateTime;

    /**
     * Date on which the purchase has been paid, if any.
     */
    paid?: Temporal.ZonedDateTime;

    /**
     * Tickets that were created as part of this purchase.
     */
    tickets: {
        /**
         * Unique ID of this ticket.
         */
        id: number | string;

        /**
         * Unique ID of the ticket type that this ticket is an example of.
         */
        ticketId: number | string;

        /**
         * Name of the ticket type, when known.
         */
        ticketName?: string;

        /**
         * Barcode through which the ticket can be scanned.
         */
        barcode?: string;

        /**
         * Name of the holder of the ticket. May be anonimised after an event concludes.
         */
        holder?: string;

        /**
         * Nickname of the holder of the ticket, when known.
         */
        nickname?: string;

    }[];
}

/**
 * Interface that describes the information that will be obtained for each ticket.
 */
export interface Ticket {
    /**
     * Unique ID of this ticket.
     */
    id: number | string;

    /**
     * Unique ID of the purchase that this ticket was issued for.
     */
    purchaseId: number | string;

    /**
     * Unique ID of the ticket type that this ticket is an example of.
     */
    ticketId: number | string;

    /**
     * Barcode through which the ticket can be scanned.
     */
    barcode?: string;

    /**
     * Name of the holder of the ticket. May be anonimised after an event concludes.
     */
    holder?: string;

    /**
     * Nickname of the holder of the ticket, when known.
     */
    nickname?: string;

    /**
     * Whether the ticket was complimentary, i.e. issued without requiring payment.
     */
    complimentary?: boolean;

    /**
     * Date on which the ticket has been cancelled, if any.
     */
    cancelled?: Temporal.ZonedDateTime;

    /**
     * Date on which the ticket has been paid, if any.
     */
    paid?: Temporal.ZonedDateTime;
}

/**
 * Interface that describes the information necessary to request creation of a ticket.
 */
export interface TicketCreateRequest {
    /**
     * Unique ID of the ticket type that should be issued.
     */
    type: number | string;

    /**
     * First name of the ticket holder.
     */
    firstName: string;

    /**
     * Last name of the ticket holder.
     */
    lastName: string;

    /**
     * E-mail address to which ticket information should be sent.
     */
    emailAddress: string;
}

/**
 * Interface that describes high level statistics that should be available for tickets.
 */
export interface TicketStatistics {
    /**
     * Number of tickets that have been issued.
     */
    tickets: {
        purchases: number;
        guestList: number;
    };

    /**
     * Number of subproducts that have been issued.
     */
    subproducts: {
        purchases: number;
        guestList: number;
    };

    /**
     * Number of products (both tickets and subproducts) issued in the past week.
     */
    lastWeek: {
        purchases: number;
        guestList: number;
    };

    /**
     * Number of products (both tickets and subproducts) issued in total.
     */
    total: {
        purchases: number;
        guestList: number;
    };
}

/**
 * Interface that describes the information that will be obtained for each ticket type.
 */
export interface TicketType {
    /**
     * Unique ID of this ticket type.
     */
    id: number | string;

    /**
     * Human readable name that describes this ticket.
     */
    name: string;

    /**
     * Price of the ticket, in cents to avoid floating point inaccuracy issues.
     */
    price: number;

    /**
     * Whether the ticket type is currently active
     */
    active: boolean;

    /**
     * Number of sold (non-cancelled, issued) tickets of this type, when known.
     */
    sold?: number;

    /**
     * Number of tickets of this type that can be issued.
     */
    amount?: number;
}

/**
 * Valid sort fields for ticket search results.
 */
export type TicketSearchSortField = 'cancelled' | 'holder' | 'order' | 'purchased' | 'ticket';

/**
 * Interface that describes a search query for tickets.
 */
export interface TicketSearchRequest {
    /**
     * Search query string to match against ticket holder, ticket name, order/ticket IDs, or barcode.
     */
    query: string;

    /**
     * Maximum number of results to return.
     */
    limit: number;

    /**
     * Offset into the result set for pagination.
     */
    offset: number;

    /**
     * Optional sorting configuration for the results.
     */
    sort?: {
        field: TicketSearchSortField;
        direction: 'asc' | 'desc';
    };
}

/**
 * Interface that describes a single ticket search result.
 */
export interface TicketSearchResult {
    /**
     * Unique ID of this ticket.
     */
    id: number | string;

    /**
     * Unique ID of the purchase that this ticket was issued for.
     */
    purchaseId: number | string;

    /**
     * Unique ID of the ticket type that this ticket is an example of.
     */
    ticketId: number | string;

    /**
     * Name of the holder of the ticket, when known.
     */
    holder?: string;

    /**
     * Name of the ticket type, when known.
     */
    ticketName?: string;

    /**
     * Date/time string when the ticket was purchased, if settled.
     */
    purchased?: string;

    /**
     * Whether the ticket has been cancelled.
     */
    cancelled: boolean;

    /**
     * Whether the ticket was complimentary, i.e. issued without requiring payment.
     */
    complimentary?: boolean;
}

/**
 * Interface that describes a paginated list of ticket search results.
 */
export interface TicketSearchResults {
    /**
     * Total number of matching tickets across all pages.
     */
    count: number;

    /**
     * Matching tickets for the requested page.
     */
    results: TicketSearchResult[];
}

/**
 * Summary of financial import status and uncategorised ticket types for an event.
 */
export interface TicketFinancialSummary {
    /**
     * Timestamp of the most recent ticket/order update imported for this event, if any.
     */
    mostRecentUpdate?: Temporal.ZonedDateTime;

    /**
     * Number of active ticket types that have not yet been assigned a financial category.
     */
    pendingCategorisationCount: number;
}

/**
 * Aggregated sales count for a single product on a single UTC calendar date (`YYYY-MM-DD`).
 */
export interface ProviderSale {
    /**
     * UTC calendar date (`YYYY-MM-DD`) on which the sales were recorded.
     */
    date: string;

    /**
     * Whether these sales were issued free of charge (complimentary / guest list).
     */
    complimentary: boolean;

    /**
     * Number of items sold on `date` matching `complimentary`.
     */
    count: number;
}

/**
 * Provider-neutral representation of a configured product and its daily sales for graphing.
 */
export interface ProviderProductSales {
    /**
     * Unique ID of the configured ticket entry (`events_tickets_configuration.event_ticket_id`).
     */
    id: number;

    /**
     * Maximum number of items that can be sold for this product, when capped.
     */
    limit?: number;

    /**
     * Human-readable name of the product as imported from the ticketing provider.
     */
    product: string;

    /**
     * Daily sales recorded for this product across valid orders.
     */
    sales: ProviderSale[];
}

/**
 * Provider-neutral representation of a categorised event product and its raw daily sales.
 */
export interface ProviderProduct extends ProviderProductSales {
    /**
     * Category of sale that this product belongs to.
     */
    category: EventTicketCategory;

    /**
     * Unit price, in local currency, for which this product is sold.
     */
    price?: number;

    /**
     * Optional AnPlan program association configured for this product.
     */
    program: {
        id?: number;
        title?: string;
    };
}

/**
 * Configuration for a single ticket type in an event (`events_tickets_configuration`).
 */
export interface TicketConfiguration {
    /**
     * Unique ID of the configuration row in the database.
     */
    id: number;

    /**
     * Provider-specific ticket type ID (e.g., Weeztix GUID or YourTicketProvider ticket ID).
     */
    ticketTypeId: number | string;

    /**
     * Financial category assigned to this ticket type, if any.
     */
    category?: EventTicketCategory;

    /**
     * Optional AnPlan activity ID associated with this ticket type.
     */
    activityId?: number;
}

/**
 * Status of a volunteer's associated ticket for an event.
 */
export interface VolunteerTicket {
    /**
     * Purchase ID associated with the volunteer.
     */
    purchaseId: number | string;

    /**
     * Date/time string when the purchase was paid, if settled.
     */
    paid?: string;

    /**
     * Whether the purchase has been cancelled.
     */
    cancelled: boolean;
}

/**
 * Editable details of an individual ticket holder.
 */
export interface TicketDetails {
    /**
     * First name of the ticket holder.
     */
    firstName: string;

    /**
     * Last name of the ticket holder.
     */
    lastName: string;

    /**
     * E-mail address of the ticket holder.
     */
    email: string;
}
