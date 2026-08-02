// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { Cache } from '@lib/cache';
import { LogBuilder } from '@lib/log/index';
import { createTicketService } from '@lib/tickets';
import { executeServerAction } from '@lib/serverAction';
import { requireAuthenticationWithEvent } from '../requireAuthenticationWithEvent';
import db, { tEvents } from '@lib/database';

import { kEventTicketProvider } from '@lib/database/Types';

/**
 * Data that needs to be available to create a new ticket.
 */
const kCreateExternalTicketData = z.object({
    firstName: z.string().nonempty(),
    lastName: z.string().nonempty(),
    displayName: z.string().optional(),
    email: z.email().nonempty(),
});

/**
 * Server Action through which a ticket for an external volunteer can be created.
 */
export async function createExternalTicket(eventSlug: string, formData: unknown) {
    return executeServerAction(formData, kCreateExternalTicketData, async (data, props) => {
        const { event } = await requireAuthenticationWithEvent(
            eventSlug, props.authenticationContext, {
                permission: 'event.tickets',
                operation: 'create',
            });

        const service = await createTicketService(event.id);
        if (!service || !event.tickets?.volunteerTicketId)
            notFound();

        try {
            const ticket = await service.createTicket({
                type: event.tickets.volunteerTicketId,
                firstName: data.firstName,
                lastName: data.lastName,
                displayName: data.displayName,
                emailAddress: data.email,
            });

            console.log(ticket);

            // TODO: Log

        } catch (error: any) {
            console.error(error);
            return {
                success: false,
                error: error.message,
            };
        }

        return { success: false };
    });
}

/**
 * Data that needs to be available to update the ticket settings.
 */
const kTicketSettingsData = z.object({
    provider: z.enum(kEventTicketProvider).or(z.literal('')),
    ticketId: z.string().optional(),
    autoGrant: z.literal([ 0, 1 ]),
    autoRevoke: z.literal([ 0, 1 ]),
});

/**
 * Server Action through which settings for an event's ticket management can be updated.
 */
export async function updateTicketSettings(eventSlug: string, formData: unknown) {
    return executeServerAction(formData, kTicketSettingsData, async (data, props) => {
        const { event } = await requireAuthenticationWithEvent(
            eventSlug, props.authenticationContext, 'event.settings');

        const validEnvironment = !!data.provider && !!data.ticketId;

        const autoGrant = validEnvironment && data.autoGrant === 1;
        const autoRevoke = validEnvironment && data.autoRevoke === 1;

        const affectedRows = await db.update(tEvents)
            .set({
                ticketsProvider: data.provider === '' ? null : data.provider,
                ticketsAutoGrantTicketId: data.ticketId,
                ticketsAutoGrantEnabled: autoGrant ? 1 : 0,
                ticketsAutoRevokeEnabled: autoRevoke ? 1 : 0,
            })
            .where(tEvents.eventId.equals(event.id))
            .executeUpdate();

        Cache.getInstance('EventCache').delete(event.slug);

        LogBuilder.for('UpdateEventTicketSettings')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withDiff({
                Provider: {
                    before: event.tickets?.provider || '',
                    after: data.provider,
                },
                TicketType: {
                    before: event.tickets?.volunteerTicketId || '',
                    after: data.ticketId || '',
                },
                AutoGrant: {
                    before: !!event.tickets?.enableAutoGrant,
                    after: autoGrant,
                },
                AutoRevoke: {
                    before: !!event.tickets?.enableAutoRevoke,
                    after: autoRevoke,
                },
            })
            .withSeverity('Warning')
            .record({ event: event.shortName });

        return { success: true };
    });
}
