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
import db, { tEvents, tUsersEventsTickets } from '@lib/database';

import { kEventTicketProvider } from '@lib/database/Types';
import { YourTicketProviderImportTask } from '@lib/scheduler/tasks/YourTicketProviderImportTask';

/**
 * Data required to associate a purchase with a volunteer.
 */
const kAssociatePurchaseData = z.object({
    ticketProvider: z.enum(kEventTicketProvider),
    userId: z.number(),
});

/**
 * Server Action that allows the given `purchaseId` to be associated with a volunteer.
 */
export async function associatePurchase(
    eventSlug: string, purchaseId: string | number, formData: unknown)
{
    return executeServerAction(formData, kAssociatePurchaseData, async (data, props) => {
        const { event } = await requireAuthenticationWithEvent(
            eventSlug, props.authenticationContext, {
                permission: 'event.tickets',
                operation: 'update',
            });

        const affectedRows = await db.insertInto(tUsersEventsTickets)
            .set({
                userId: data.userId,
                eventId: event.id,
                ticketProvider: 'YourTicketProvider',
                ticketProviderPurchaseId: purchaseId.toString(),
            })
            .onConflictDoNothing()
            .executeInsert();

        if (!affectedRows) {
            return {
                success: false,
                error: 'Unable to associate the ticket, do they already have one?',
            };
        }

        LogBuilder.for('AssociateTicket')
            .withInitiatorUser(props.user)
            .withAffectedUser(data.userId)
            .record({
                event: event.shortName,
            });

        return {
            success: true,
            redirect: `/admin/events/${event.slug}/tickets/volunteers/${data.userId}`,
        };
    });
}

/**
 * Data that needs to be available to create a new ticket.
 */
const kCreateExternalTicketData = z.object({
    firstName: z.string().nonempty(),
    lastName: z.string().nonempty(),
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

        const ticket = await service.createTicket({
            type: event.tickets.volunteerTicketId,
            firstName: data.firstName,
            lastName: data.lastName,
            emailAddress: data.email,
        });

        if (!ticket)
            return { success: false, error: 'Unable to issue a ticket at this time' };

        LogBuilder.for('CreateExternalTicket')
            .withInitiatorUser(props.user)
            .withSeverity('Error')
            .record({
                event: event.shortName,
                recipient: `${data.firstName} ${data.lastName}`,
                purchaseId: ticket.purchaseId,
            });

        // Import the purchase into our database if required, so that it's immediately visible
        // across our systems. The import routine will pick it up properly at the next interval.
        try {
            switch (service.id) {
                case 'YourTicketProvider':
                    await YourTicketProviderImportTask.importPurchase(
                        Number(service.eventId), Number(ticket.purchaseId));
                    break;
            }
        } catch (error) {
            console.error('Unable to import a new purchase:', error);
            return {
                success: true,
                message:
                    'The ticket has been created, but it could not be imported into our system. ' +
                    'Please allow up to 24 hours for it to appear.',
            };
        }

        return {
            success: true,
            redirect: `./externals/${ticket.purchaseId}`,
        };
    });
}

/**
 * Server Action through which the ticket associated with |userId| will be disassociated.
 */
export async function disassociatePurchase(eventSlug: string, userId: number) {
    return executeServerAction({ /* none */ }, z.object(), async (data, props) => {
        const { event } = await requireAuthenticationWithEvent(
            eventSlug, props.authenticationContext, {
                permission: 'event.tickets',
                operation: 'update',
            });

        const affectedRows = await db.deleteFrom(tUsersEventsTickets)
            .where(tUsersEventsTickets.userId.equals(userId))
                .and(tUsersEventsTickets.eventId.equals(event.id))
            .executeDelete();

        LogBuilder.for('DisassociateTicket')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withAffectedUser(userId)
            .record({
                event: event.shortName,
            });

        return {
            success: true,
            refresh: true,
        };
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
