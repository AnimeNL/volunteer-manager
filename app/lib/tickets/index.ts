// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { TicketService } from './TicketService';
import { Weeztix } from './backends/Weeztix';
import { YourTicketProvider } from './backends/YourTicketProvider';
import { getEvent } from '@lib/cache';

/**
 * Creates a ticket service for the given `eventIdentifier`, which may either be a unique event ID
 * or an URL-safe event slug. An instance of the `TicketService` will be returned when successful,
 * whereas `undefined` will be returned when no ticket service is available.
 */
export async function createTicketService(eventIdentifier: number | string, userId?: number)
    : Promise<TicketService | undefined>
{
    const event = await getEvent(eventIdentifier);
    if (!event)
        return undefined;

    let service: TicketService | undefined;
    switch (event.tickets?.provider) {
        case 'Weeztix':
            if (!!event?.integrations?.weeztixGuid)
                service = new Weeztix();

            break;

        case 'YourTicketProvider':
            if (!!event?.integrations?.yourTicketProviderEventId) {
                service = new YourTicketProvider(
                    event.integrations.yourTicketProviderEventId, userId);
            }

            break;
    }

    if (!service)
        return undefined;

    await service.initialise();

    return service;
}
