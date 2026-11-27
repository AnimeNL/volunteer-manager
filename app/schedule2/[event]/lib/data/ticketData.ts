// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';
import { cache } from 'react';

import type { CachedEvent } from '@lib/cache';
import type { TicketConfiguration } from '@lib/tickets/Types';
import { createTicketService, isTicketServiceConfigured } from '@lib/tickets';

/**
 * Ticket sales summary for a single product linked to a program event.
 */
export interface EventTicketSalesEntry {
    id: number;
    limit?: number;
    name: string;
    price?: number;
    sold: number;
}

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
 * Request-cached query loading all configured ticket types for `eventId`.
 */
const loadTicketConfigurations = cache(
    async (eventId: number): Promise<TicketConfiguration[]> => {
        const service = await createTicketService(eventId);
        if (!service)
            return [];

        return service.listTicketConfigurations(eventId);
    });

/**
 * Strips the redundant `activityTitle` prefix and leading `"on "` from a ticket product name.
 */
function formatProductName(productName: string, activityTitle: string): string {
    const trimmedProduct = productName.trim();
    const trimmedTitle = activityTitle.trim();

    let label = trimmedProduct;
    if (trimmedTitle && label.toLowerCase().startsWith(trimmedTitle.toLowerCase())) {
        label = label.slice(trimmedTitle.length)
            .replace(/^[\s\-–—:]+/, '')
            .replace(/^on\s+/i, '')
            .trim();
    } else {
        label = label.replace(/^on\s+/i, '').trim();
    }

    return label || trimmedProduct;
}

/**
 * Returns ticket sales entries linked to `activityId` for `event`, or an empty list when ticketing
 * is not configured or no ticket types are associated with the activity.
 */
export async function getEventTicketSales(
    event: Pick<CachedEvent, 'id' | 'integrations' | 'tickets'>,
    activityId: number,
    activityTitle: string): Promise<EventTicketSalesEntry[]>
{
    if (!isTicketServiceConfigured(event))
        return [];

    const configurations = await loadTicketConfigurations(event.id);
    return configurations
        .filter(config => config.activityId === activityId && !!config.name)
        .map(config => ({
            id: config.id,
            limit: config.amount !== undefined && config.amount > 0 ? config.amount : undefined,
            name: formatProductName(config.name!, activityTitle),
            price: config.price !== undefined && config.price > 0 ? config.price : undefined,
            sold: config.sold ?? 0,
        }))
        .sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));
}

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
