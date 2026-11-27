// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';
import { cache } from 'react';

import type { CachedEvent } from '@lib/cache';
import type { TicketConfiguration } from '@lib/tickets/Types';
import { createTicketService, isTicketServiceConfigured } from '@lib/tickets';

/**
 * Individual ticket holder entry for a program event's ticket product.
 */
interface EventTicketHolder {
    barcode?: string;
    id: string;
    name: string;
    orderNumber: string;
}

/**
 * Resolved ticket product name and active ticket holders for a program event.
 */
interface EventTicketHoldersResult {
    holders: EventTicketHolder[];
    productName: string;
}

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
 * Request-cached lookup for the event's ticketing service instance.
 */
const getTicketService = cache(
    async (eventId: number) => await createTicketService(eventId));

/**
 * Request-cached query loading the assigned festival ticket for `userId` in `eventId`.
 */
const loadVolunteerTicket = cache(
    async (eventId: number, userId: number): Promise<VolunteerTicketDetails | undefined> => {
        const service = await getTicketService(eventId);
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
        const service = await getTicketService(eventId);
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
 * Request-cached query loading active ticket holders for a configured event ticket product.
 */
const loadEventTicketHolders = cache(
    async (
        eventId: number, activityId: number, activityTitle: string, eventTicketId: number)
        : Promise<EventTicketHoldersResult | undefined> =>
    {
        const service = await getTicketService(eventId);
        if (!service)
            return undefined;

        const configurations = await loadTicketConfigurations(eventId);
        const config = configurations.find(entry =>
            entry.id === eventTicketId && entry.activityId === activityId && !!entry.name);
        if (!config?.name)
            return undefined;

        const tickets = await service.listTicketsForType(config.ticketTypeId);
        const holders = tickets
            .filter(ticket => !ticket.cancelled)
            .map(ticket => ({
                barcode: ticket.barcode,
                id: `${ticket.id}`,
                name: ticket.holder?.trim() || 'Unknown holder',
                orderNumber: service.formatPurchaseId(ticket.purchaseId),
            }))
            .sort((lhs, rhs) =>
                lhs.name.localeCompare(rhs.name) ||
                lhs.orderNumber.localeCompare(rhs.orderNumber) ||
                lhs.id.localeCompare(rhs.id));

        return {
            holders,
            productName: formatProductName(config.name, activityTitle),
        };
    });

/**
 * Returns the product name and active ticket holders for `eventTicketId` belonging to `activityId`
 * in `event`, or `undefined` when ticketing is not configured or the product does not exist.
 */
export async function getEventTicketHolders(
    event: Pick<CachedEvent, 'id' | 'integrations' | 'tickets'>,
    activityId: number,
    activityTitle: string,
    eventTicketId: number): Promise<EventTicketHoldersResult | undefined>
{
    if (!isTicketServiceConfigured(event))
        return undefined;

    return loadEventTicketHolders(event.id, activityId, activityTitle, eventTicketId);
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
 * Returns the set of AnPlan activity IDs that have at least one configured ticket product linked
 * in `event`, or an empty set when ticketing is not configured.
 */
export async function getTicketedActivityIds(
    event: Pick<CachedEvent, 'id' | 'integrations' | 'tickets'>): Promise<Set<number>>
{
    if (!isTicketServiceConfigured(event))
        return new Set();

    const configurations = await loadTicketConfigurations(event.id);
    const activityIds = new Set<number>();
    for (const config of configurations) {
        if (config.activityId !== undefined && !!config.name)
            activityIds.add(config.activityId);
    }

    return activityIds;
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
