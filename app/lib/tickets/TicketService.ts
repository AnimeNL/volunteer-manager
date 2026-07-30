// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { TicketBackend } from './TicketBackend';
import type { TicketType } from './Types';

/**
 * The `TicketService` is the primary API through which event tickets can be managed, for example to
 * automatically manage tickets for our volunteers. It's backed by a `TicketBackend` implementation
 * that knows how to integrate with a particular ticket provider.
 */
export class TicketService {
    #backend: TicketBackend;

    constructor(backend: TicketBackend) {
        this.#backend = backend;
    }

    /**
     * Lists the ticket types that exist for the current event. This will make an API call.
     */
    async listTicketTypes(): Promise<TicketType[]> {
        return this.#backend.listTicketTypes();
    }
}
