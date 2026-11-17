// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { CachedEvent } from '@lib/cache/Types';
import type { EventTicketProvider } from '@lib/database/Types';
import type { TicketService } from './TicketService';
import { Weeztix } from './backends/Weeztix';
import { YourTicketProvider } from './backends/YourTicketProvider';
import { getEvent } from '@lib/cache';
import { readSetting } from '@lib/Settings';

/**
 * Returns whether the given `event` has a configured ticket service.
 */
export function isTicketServiceConfigured(
    event: Pick<CachedEvent, 'tickets' | 'integrations'>): boolean
{
    switch (event.tickets?.provider) {
        case 'Weeztix':
            return !!event.integrations?.weeztixEventId;

        case 'YourTicketProvider':
            return !!event.integrations?.yourTicketProviderEventId;
    }

    return false;
}

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

    let service: TicketService | undefined;
    switch (event.tickets?.provider) {
        case 'Weeztix': {
            const weeztixCompanyId = await readSetting('integration-weeztix-company-id');
            if (!!event?.integrations?.weeztixEventId && !!weeztixCompanyId)
                service = new Weeztix(event.integrations.weeztixEventId, weeztixCompanyId);

            break;
        }

        case 'YourTicketProvider':
            if (!!event?.integrations?.yourTicketProviderEventId)
                service = new YourTicketProvider(event.integrations.yourTicketProviderEventId);

            break;
    }

    return service;
}

/**
 * Creates a ticket service directly from a known `provider` and `providerEventId`.
 */
export function createTicketServiceForProvider(
    provider: EventTicketProvider, providerEventId: number | string): TicketService | undefined
{
    switch (provider) {
        case 'Weeztix':
            return new Weeztix(String(providerEventId));

        case 'YourTicketProvider':
            return new YourTicketProvider(Number(providerEventId));
    }
}
