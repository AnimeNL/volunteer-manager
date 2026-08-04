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
