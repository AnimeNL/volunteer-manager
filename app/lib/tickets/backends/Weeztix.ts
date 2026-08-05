// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Ticket, TicketCreateRequest, TicketType } from '../Types';
import type { TicketBackend } from '../TicketBackend';

/**
 * Implementation of the `TicketBackend` specific to Weeztix.
 * @see https://docs.weeztix.com/api/dashboard/dashboard
 */
export class Weeztix implements TicketBackend {
    // ---------------------------------------------------------------------------------------------
    // TicketBackend implementation:
    // ---------------------------------------------------------------------------------------------

    async initialise(): Promise<void> {}

    async createTicket(request: TicketCreateRequest): Promise<Pick<Ticket, 'purchaseId'>> {
        throw new Error('Not yet implemented');
    }

    async listTicketTypes(): Promise<TicketType[]> {
        throw new Error('Not yet implemented');
    }

    async listTicketsForType(id: number | string): Promise<Ticket[]> {
        throw new Error('Not yet implemented');
    }
}
