// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

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
