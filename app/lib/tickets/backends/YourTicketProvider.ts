// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { TicketBackend } from '../TicketBackend';
import type { TicketType } from '../Types';
import { type YourTicketProviderClient, createYourTicketProviderClient }
    from '@app/lib/integrations/yourticketprovider';

/**
 * Implementation of the `TicketBackend` specific to YourTicketProvider and/or CM.com.
 * @see https://ytpstorage1.blob.core.windows.net/media/YTP%20Ticketing%20API%20Specifications.pdf
 */
export class YourTicketProvider implements TicketBackend {
    #client: YourTicketProviderClient | undefined;
    #eventId: number;

    constructor(eventId: number) {
        this.#eventId = eventId;
    }

    // ---------------------------------------------------------------------------------------------
    // TicketBackend implementation:
    // ---------------------------------------------------------------------------------------------

    async initialise(): Promise<void> {
        this.#client = await createYourTicketProviderClient();
    }

    async listTicketTypes(): Promise<TicketType[]> {
        if (!this.#client)
            throw new Error('Unable to execute listTicketTypes() without a valid client');

        const types = await this.#client.listTicketTypes(this.#eventId);
        return types.map(type => ({
            id: type.Id,
            name: type.Name,
            price: type.Price,
            active: type.Live,
        }));
    }
}
