// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';
import { cache } from 'react';

import type { CachedEvent } from '@lib/cache';
import { createTicketService, isTicketServiceConfigured } from '@lib/tickets';

/**
 * Details of a volunteer's valid festival ticket for display in the schedule portal.
 */
interface VolunteerTicketDetails {
    barcode: string;
    orderNumber: string;
}

/**
 * Request-cached query loading the assigned festival ticket for `userId` in `eventId`.
 */
const loadVolunteerTicket = cache(
    async (eventId: number, userId: number): Promise<VolunteerTicketDetails | undefined> => {
        const service = await createTicketService(eventId);
        if (!service)
            return undefined;

        const tickets = await service.listVolunteerTickets(eventId, [ userId ]);
        const ticket = tickets.get(userId);
        if (!ticket || ticket.cancelled || !ticket.barcode)
            return undefined;

        return {
            barcode: ticket.barcode,
            orderNumber: service.formatPurchaseId(ticket.purchaseId),
        };
    });

/**
 * Returns the barcode and formatted order number of the valid, non-cancelled festival ticket
 * assigned to `userId` for `event`, or `undefined` when ticketing is not configured or no ticket
 * has been issued.
 */
export async function getVolunteerTicket(
    event: Pick<CachedEvent, 'id' | 'integrations' | 'tickets'>, userId: number)
    : Promise<VolunteerTicketDetails | undefined>
{
    if (!isTicketServiceConfigured(event))
        return undefined;

    return loadVolunteerTicket(event.id, userId);
}
