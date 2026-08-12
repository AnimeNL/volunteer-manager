// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { EventTicketProvider } from '@lib/database/Types';
import type { Purchase, Ticket, TicketCreateRequest, TicketType } from '../Types';
import type { TicketService } from '../TicketService';

/**
 * Implementation of the `TicketService` specific to Weeztix.
 * @see https://docs.weeztix.com/api/dashboard/dashboard
 */
export class Weeztix implements TicketService {
    // ---------------------------------------------------------------------------------------------
    // TicketBackend implementation:
    // ---------------------------------------------------------------------------------------------

    get id(): EventTicketProvider { return 'Weeztix' };
    get eventId(): number | string {
        throw new Error('Not yet implemented');
    }
    get client(): unknown {
        throw new Error('Not yet implemented');
    }

    async initialise(): Promise<void> {}

    async cancelPurchase(purchaseId: number | string): Promise<void> {
        throw new Error('Not yet implemented');
    }

    createPurchaseLink(purchaseId: number | string): string | undefined {
        throw new Error('Not yet implemented');
    }

    async createTicket(request: TicketCreateRequest): Promise<Pick<Ticket, 'purchaseId'>> {
        throw new Error('Not yet implemented');
    }

    async fetchPurchase(purchaseId: number | string): Promise<Purchase | undefined> {
        throw new Error('Not yet implemented');
    }

    formatPurchaseId(purchaseId: number | string): string {
        throw new Error('Not yet implemented');
    }

    async listTicketTypes(): Promise<TicketType[]> {
        throw new Error('Not yet implemented');
    }

    async listTicketsForType(id: number | string): Promise<Ticket[]> {
        throw new Error('Not yet implemented');
    }

    async sendPurchaseConfirmation(purchaseId: number | string): Promise<boolean> {
        return false;
    }
}
