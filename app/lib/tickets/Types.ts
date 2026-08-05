// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

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
}
