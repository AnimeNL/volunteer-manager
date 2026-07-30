// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { TicketBackend } from './TicketBackend';
import { TicketService } from './TicketService';
import { YourTicketProvider } from './backends/YourTicketProvider';
import { getEvent } from '@lib/cache';

/**
 * Creates a ticket service for the given `eventIdentifier`, which may either be a unique event ID
 * or an URL-safe event slug. An instance of the `TicketService` will be returned when successful,
 * whereas `undefined` will be returned when no ticket service is available.
 */
export async function createTicketService(eventIdentifier: number | string)
    : Promise<TicketService | undefined>
{
    const event = await getEvent(eventIdentifier);

    let backend: TicketBackend | undefined;
    if (!!event?.integrations?.yourTicketProviderId) {
        backend = new YourTicketProvider(event.integrations.yourTicketProviderId);
    } else if (!!event?.integrations?.weeztixGuid) {
        throw new Error('No backend implementation for Weeztix');
    }

    if (!backend)
        return undefined;

    await backend.initialise();

    return new TicketService(backend);
}
