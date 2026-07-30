// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { TicketBackend } from './TicketBackend';
import type { TicketType } from './Types';
import { Cache } from '../cache';

/**
 * The `TicketService` is the primary API through which event tickets can be managed, for example to
 * automatically manage tickets for our volunteers. It's backed by a `TicketBackend` implementation
 * that knows how to integrate with a particular ticket provider.
 */
export class TicketService {
    #backend: TicketBackend;
    #event: string;

    constructor(backend: TicketBackend, event: string) {
        this.#backend = backend;
        this.#event = event;
    }

    /**
     * Lists the ticket types that exist for the current event. This will prefer to return from the
     * local cache unless `skipCache` is set to `true`.
     */
    async listTicketTypes(skipCache?: boolean): Promise<TicketType[]> {
        return await Cache.getInstance('EventTicketTypes').getOrInsert(this.#event, async () => {
            return this.#backend.listTicketTypes()
        }, skipCache) || [ /* no ticket types */ ];
    }
}
