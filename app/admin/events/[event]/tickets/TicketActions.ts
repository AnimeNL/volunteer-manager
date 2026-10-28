// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { forbidden, notFound } from 'next/navigation';
import { z } from 'zod/v4';

import type { YourTicketProviderClient } from '@lib/integrations/yourticketprovider';
import { Cache } from '@lib/cache';
import { LogBuilder } from '@lib/log/index';
import { YourTicketProviderImportTask } from '@lib/scheduler/tasks/YourTicketProviderImportTask';
import { createTicketService } from '@lib/tickets';
import { executeServerAction } from '@lib/serverAction';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';
import db, { tUsersEventsTickets, tYourTicketProviderPurchases } from '@lib/database';

import { kEventTicketProvider } from '@lib/database/Types';

/**
 * Whether to disable the ability to cancel purchases, which depends on figuring out how to cancel
 * zero-priced tickets in YourTicketProvider that it insists on refunding.
 */
const kCancelPurchaseDisabledPendingIssueResolution = true;

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

        // TODO: Enable this API after YourTicketProvider (hopefully) resolves the API issue.
        if (kCancelPurchaseDisabledPendingIssueResolution) {
            return {
                success: false,
                error:
                    'The ability to cancel tickets has been disabled pending a fix in ' +
                    'YourTicketProvider—use YTP directly for now.',
            };
        }

        const service = await createTicketService(event.id, props.user.id);
        if (!service || !event.tickets?.volunteerTicketId)
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

        // Clear any cached variants of the issued tickets, as they are no logner valid.
        for (const ticket of purchase.tickets)
            Cache.getInstance('EventTicketCache').delete(ticket.id);

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

        const service = await createTicketService(event.id, props.user.id);
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
            switch (service.id) {
                case 'YourTicketProvider':
                    await YourTicketProviderImportTask.importPurchase(
                        Number(service.eventId), Number(ticket.purchaseId), props.user.id);
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

        const service = await createTicketService(event.id, props.user.id);
        if (!service || !event.tickets?.volunteerTicketId)
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

/**
 * Data necessary to update a purchase issued by YourTicketProvider.
 */
const kUpdateYtpPurchaseData = z.object({
    Email: z.email(),
});

/**
 * Server Action through which an individual purchase issued by YourTicketProvider can be updated.
 */
export async function updateYourTicketProviderPurchase(
    eventSlug: string, purchaseId: number, formData: unknown)
{
    return executeServerAction(formData, kUpdateYtpPurchaseData, async (data, props) => {
        const { event } = await requireAuthenticationWithEvent(
            props.authenticationContext, eventSlug, {
                permission: 'volunteers.tickets',
                operation: 'update',
            });

        // TODO: Enable this API after YourTicketProvider (hopefully) resolves the API issue.
        if (kCancelPurchaseDisabledPendingIssueResolution) {
            return {
                success: false,
                error:
                    'The ability to update purchases has been disabled pending a fix in ' +
                    'YourTicketProvider—use YTP directly for now.',
            };
        }

        const service = await createTicketService(event.id, props.user.id);
        if (!service || !service.client)
            notFound();

        const client = service.client as YourTicketProviderClient;
        await client.postUpdatePurchase(purchaseId, {
            Email: data.Email,
            IncludeTicketGuarantee: false,
            Language: 'en',
            BasketId: null,
            HasAcceptedTermsAndAgreements: true,
        });

        // Remove the cached information as it's no longer relevant:
        Cache.getInstance('EventPurchaseCache').delete(purchaseId);

        LogBuilder.for('UpdateTicketPurchase')
            .withInitiatorUser(props.user)
            .withSeverity('Error')
            .record({
                event: event.shortName,
                purchaseId: `REF${purchaseId}`,
            });

        return {
            success: true,
            refresh: true,
        };
    });
}

/**
 * Data necessary to update a ticket issued by YourTicketProvider.
 */
const kUpdateYtpTicketData = z.object({
    TicketHolderFirstname: z.string().nonempty(),
    TicketHolderLastname: z.string().nonempty(),
    TicketHolderEmail: z.string().nonempty(),
});

/**
 * Server Action through which an individual ticket issued by YourTicketProvider can be updated.
 */
export async function updateYourTicketProviderTicket(
    eventSlug: string, purchaseItemId: number, formData: unknown)
{
    return executeServerAction(formData, kUpdateYtpTicketData, async (data, props) => {
        const { event } = await requireAuthenticationWithEvent(
            props.authenticationContext, eventSlug, {
                permission: 'volunteers.tickets',
                operation: 'update',
            });

        const service = await createTicketService(event.id, props.user.id);
        if (!service || !service.client)
            notFound();

        const client = service.client as YourTicketProviderClient;
        const ticket = await client.patchPurchaseItem(purchaseItemId, {
            TicketHolderFirstname: data.TicketHolderFirstname,
            TicketHolderLastname: data.TicketHolderLastname,
            TicketHolderEmail: data.TicketHolderEmail,
            // TODO: TicketHolderOrganisation
            // TODO: TicketHolderDepartment
            // TODO: TicketHolderPosition
        });

        // Overwrite the cached ticket with the updated representation received from the server:
        Cache.getInstance('EventTicketCache').set(purchaseItemId, ticket);

        const ytpPurchaseItemHolder = [
            ticket.TicketHolderFirstname,
            ticket.TicketHolderInsertion,
            ticket.TicketHolderLastname,
        ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || null;

        await db.update(tYourTicketProviderPurchases)
            .set({ ytpPurchaseItemHolder })
            .where(tYourTicketProviderPurchases.ytpPurchaseItemId.equals(purchaseItemId))
            .executeUpdate();

        LogBuilder.for('UpdateAssociateTicket')
            .withInitiatorUser(props.user)
            .withSeverity('Error')
            .record({
                event: event.shortName,
                recipient: ytpPurchaseItemHolder || '(unknown)',
                purchaseId: ticket.Id,
            });

        return {
            success: true,
            refresh: true,
        };
    });
}
