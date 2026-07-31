// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { TicketBackend } from '../TicketBackend';
import type { TicketType } from '../Types';
import { type WeeztixClient, createWeeztixClient } from '@app/lib/integrations/weeztix';

/**
 * Implementation of the `TicketBackend` specific to Weeztix.
 * @see https://docs.weeztix.com/api/dashboard/dashboard
 */
export class Weeztix implements TicketBackend {
    #client: WeeztixClient | undefined;
    #eventGuid: string;

    constructor(eventGuid: string) {
        this.#eventGuid = eventGuid;
    }

    // ---------------------------------------------------------------------------------------------
    // TicketBackend implementation:
    // ---------------------------------------------------------------------------------------------

    async initialise(): Promise<void> {
        this.#client = await createWeeztixClient();
    }

    async listTicketTypes(): Promise<TicketType[]> {
        if (!this.#client)
            throw new Error('Unable to execute listTicketTypes() without a valid client');

        const tickets = await this.#client.listTicketTypes(this.#eventGuid);
        return tickets.map(type => ({
            id: type.guid,
            name: type.name,
            price: type.min_price,
            active: true,
        }));
    }
}
