// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';
import { cache } from 'react';

import type { CachedEvent } from '@lib/cache';
import { createTicketService, isTicketServiceConfigured } from '@lib/tickets';

/**
 * Request-cached query loading the assigned festival ticket barcode for `userId` in `eventId`.
 */
const loadVolunteerTicketBarcode = cache(
    async (eventId: number, userId: number): Promise<string | undefined> => {
        const service = await createTicketService(eventId);
        if (!service)
            return undefined;

        const tickets = await service.listVolunteerTickets(eventId, [ userId ]);
        const ticket = tickets.get(userId);
        if (!ticket || ticket.cancelled || !ticket.barcode)
            return undefined;

        return ticket.barcode;
    });

/**
 * Returns the barcode of the valid, non-cancelled festival ticket assigned to `userId` for `event`,
 * or `undefined` when ticketing is not configured or no ticket has been issued.
 */
export async function getVolunteerTicketBarcode(
    event: Pick<CachedEvent, 'id' | 'integrations' | 'tickets'>, userId: number)
    : Promise<string | undefined>
{
    if (!isTicketServiceConfigured(event))
        return undefined;

    return loadVolunteerTicketBarcode(event.id, userId);
}
