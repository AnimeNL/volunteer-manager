// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { TicketType } from './Types';

/**
 * The `TicketBackend` is the interface that must be implemented for each ticket service that the
 * Volunteer Manager integrates with. This abstraction layer exists in case we switch providers.
 */
export interface TicketBackend {
    /**
     * One-time initialisation of the ticket backend. Guaranteed to be called before any other API.
     */
    initialise(): Promise<void>;

    /**
     * Lists the ticket types that exist for the current event.
     */
    listTicketTypes(): Promise<TicketType[]>;
}
