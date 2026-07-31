// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { TicketBackend } from './TicketBackend';
import { TicketService } from './TicketService';
import { Weeztix } from './backends/Weeztix';
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
    if (!event)
        return undefined;

    let backend: TicketBackend | undefined;
    switch (event.tickets?.provider) {
        case 'Weeztix':
            if (!!event?.integrations?.weeztixGuid)
                backend = new Weeztix(event.integrations.weeztixGuid);

            break;

        case 'YourTicketProvider':
            if (!!event?.integrations?.yourTicketProviderId)
                backend = new YourTicketProvider(event.integrations.yourTicketProviderId);

            break;
    }

    if (!backend)
        return undefined;

    await backend.initialise();

    return new TicketService(backend, event.slug);
}
