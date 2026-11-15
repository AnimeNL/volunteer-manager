// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { forbidden, notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { LogBuilder } from '@lib/log/index';
import { createTicketService } from '@lib/tickets';
import { executeServerAction } from '@lib/serverAction';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';
import db, { tUsersEventsTickets } from '@lib/database';

import { kEventTicketProvider } from '@lib/database/Types';

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
            props.authenticationContext, eventSlug, {
                permission: 'volunteers.tickets',
                operation: 'update',
            });

        const service = await createTicketService(event.id);
        if (!service)
            notFound();

        const affectedRows = await db.insertInto(tUsersEventsTickets)
            .set({
                userId: data.userId,
                eventId: event.id,
                ticketProvider: service.id,
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

        LogBuilder.for('AssociateTicketWithVolunteer')
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
 * Server Action through which a purchase can be cancelled. This action is irrevocable.
 */
export async function cancelPurchase(eventSlug: string, purchaseId: number | string) {
    return executeServerAction({ /* none */ }, z.object(), async (data, props) => {
        const { event } = await requireAuthenticationWithEvent(
            props.authenticationContext, eventSlug, {
                permission: 'volunteers.tickets',
                operation: 'delete',
            });

        const service = await createTicketService(event.id);
        if (!service || !service.canCancelPurchases() || !event.tickets?.volunteerTicketId)
            notFound();

        // Confirm that the |purchaseId| corresponds to a ticket that contains a volunteering
        // ticket. While not technically required, it's a safeguard to avoid cancelling arbitrary
        // tickets—whoever needs to do so can use YourTicketProvider or Weeztix directly.
        const purchase = await service.fetchPurchase(purchaseId);
        if (!purchase)
            notFound();

        let includesVolunteerTicket: boolean = false;
        for (const ticket of purchase.tickets) {
            if (event.tickets.volunteerTicketId === `${ticket.ticketId}`)
                includesVolunteerTicket = true;
        }

        if (!includesVolunteerTicket)
            forbidden();

        // Cancel the ticket with the ticketing partner. Only proceed when this succeeds.
        await service.cancelPurchase(purchaseId);

        // Write log entries for the affected tickets; associate them with a particular user when
        // it involves a known volunteer, otherwise assume that this is an associate ticket.
        const affectedUsers = await db.selectFrom(tUsersEventsTickets)
            .where(tUsersEventsTickets.ticketProviderPurchaseId.equals(purchaseId.toString()))
            .selectOneColumn(tUsersEventsTickets.userId)
            .executeSelectMany();

        if (!!affectedUsers.length) {
            await db.deleteFrom(tUsersEventsTickets)
                .where(tUsersEventsTickets.ticketProviderPurchaseId.equals(purchaseId.toString()))
                .executeDelete();

            for (const affectedUserId of affectedUsers) {
                LogBuilder.for('CancelVolunteerTicket')
                    .withInitiatorUser(props.user)
                    .withAffectedUser(affectedUserId)
                    .withSeverity('Error')
                    .record({
                        event: event.shortName,
                        purchaseId,
                    });
            }
        } else {
            LogBuilder.for('CancelAssociateTicket')
                .withInitiatorUser(props.user)
                .withSeverity('Error')
                .record({
                    event: event.shortName,
                    recipient: purchase.tickets.map(ticket => ticket.holder).join(', '),
                    purchaseId,
                });
        }

        return {
            success: true,

            close: true,
            redirect: `/admin/events/${event.slug}/tickets/associates/${purchaseId}`,
            refresh: true,
        };
    });
}

/**
 * Data that needs to be available to create a new ticket.
 */
const kCreateAssociateTicketData = z.object({
    firstName: z.string().nonempty(),
    lastName: z.string().nonempty(),
    email: z.email().nonempty(),
});

/**
 * Server Action through which a ticket for an associate volunteer can be created.
 */
export async function createAssociateTicket(eventSlug: string, formData: unknown) {
    return executeServerAction(formData, kCreateAssociateTicketData, async (data, props) => {
        const { event } = await requireAuthenticationWithEvent(
            props.authenticationContext, eventSlug, {
                permission: 'volunteers.tickets',
                operation: 'create',
            });

        const service = await createTicketService(event.id);
        if (!service || !service.canCreateTickets() || !event.tickets?.volunteerTicketId)
            notFound();

        const ticket = await service.createTicket({
            type: event.tickets.volunteerTicketId,
            firstName: data.firstName,
            lastName: data.lastName,
            emailAddress: data.email,
        });

        if (!ticket)
            return { success: false, error: 'Unable to issue a ticket at this time' };

        LogBuilder.for('CreateAssociateTicket')
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
            await service.importPurchase(ticket.purchaseId);
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
            redirect: `./associates/${ticket.purchaseId}`,
        };
    });
}

/**
 * Server Action through which the ticket associated with |userId| will be disassociated.
 */
export async function disassociatePurchase(eventSlug: string, userId: number) {
    return executeServerAction({ /* none */ }, z.object(), async (data, props) => {
        const { event } = await requireAuthenticationWithEvent(
            props.authenticationContext, eventSlug, {
                permission: 'volunteers.tickets',
                operation: 'update',
            });

        const affectedRows = await db.deleteFrom(tUsersEventsTickets)
            .where(tUsersEventsTickets.userId.equals(userId))
                .and(tUsersEventsTickets.eventId.equals(event.id))
            .executeDelete();

        LogBuilder.for('DisassociateTicketFromVolunteer')
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
 * Server Action through which the confirmation e-mail to can be redistributed.
 */
export async function resendPurchaseConfirmation(eventSlug: string, purchaseId: number | string) {
    return executeServerAction({ /* none */ }, z.object(), async (data, props) => {
        const { event } = await requireAuthenticationWithEvent(
            props.authenticationContext, eventSlug, {
                permission: 'volunteers.tickets',
                operation: 'update',
            });

        const service = await createTicketService(event.id);
        if (!service || !service.canCancelPurchases() || !event.tickets?.volunteerTicketId)
            notFound();

        const result = await service.sendPurchaseConfirmation(purchaseId);
        if (!result) {
            return {
                success: false,
                error: 'Unable to resend the confirmation e-mail at this time.',
            };
        }

        LogBuilder.for('ResendTicketConfirmation')
            .withInitiatorUser(props.user)
            .record({
                event: event.shortName,
                purchaseId,
            });

        return {
            success: true,
            message: 'They will receive an e-mail shortly.',
        };
    });
}
