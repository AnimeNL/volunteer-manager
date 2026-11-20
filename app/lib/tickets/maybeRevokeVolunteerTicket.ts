// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { CachedEvent } from '@lib/cache/Types';
import { CancelTicketTask } from '@lib/scheduler/tasks/CancelTicketTask';
import { LogBuilder } from '@lib/log/index';
import { createTicketService } from '@lib/tickets';
import db, { tUsersEvents, tUsersEventsTickets } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Options accepted by `maybeRevokeVolunteerTicket`.
 */
interface MaybeRevokeVolunteerTicketOptions {
    /**
     * Event in which the volunteer's participation was cancelled.
     */
    event: Pick<CachedEvent, 'id' | 'shortName' | 'slug' | 'tickets'>;

    /**
     * Unique ID of the user who initiated the cancellation, used for audit logging.
     */
    initiatorUserId?: number;

    /**
     * Unique ID of the volunteer whose participation was cancelled.
     */
    userId: number;
}

/**
 * Handles ticketing side effects after a volunteer's participation in an event team has been
 * cancelled:
 *
 * - If the volunteer has no associated ticket for the event, does nothing.
 * - If the volunteer still has at least one accepted participation in another team, keeps their
 *   ticket and clears `teamIdPrimary` if it no longer refers to an accepted team.
 * - Otherwise, when the event has automatic ticket revocation enabled and the ticket service
 *   supports cancellation, disassociates an active ticket and schedules a `CancelTicketTask`.
 */
export async function maybeRevokeVolunteerTicket(
    options: MaybeRevokeVolunteerTicketOptions): Promise<void>
{
    const { event, initiatorUserId, userId } = options;
    const dbInstance = db;

    const ticketRecord = await dbInstance.selectFrom(tUsersEventsTickets)
        .where(tUsersEventsTickets.userId.equals(userId))
            .and(tUsersEventsTickets.eventId.equals(event.id))
        .select({
            teamIdPrimary: tUsersEventsTickets.teamIdPrimary,
        })
        .executeSelectNoneOrOne();

    if (!ticketRecord)
        return;

    const remainingAcceptedTeamIds = await dbInstance.selectFrom(tUsersEvents)
        .where(tUsersEvents.userId.equals(userId))
            .and(tUsersEvents.eventId.equals(event.id))
            .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
        .selectOneColumn(tUsersEvents.teamId)
        .executeSelectMany();

    if (remainingAcceptedTeamIds.length > 0) {
        if (ticketRecord.teamIdPrimary !== undefined &&
                !remainingAcceptedTeamIds.includes(ticketRecord.teamIdPrimary))
        {
            await dbInstance.update(tUsersEventsTickets)
                .set({
                    teamIdPrimary: null,
                })
                .where(tUsersEventsTickets.userId.equals(userId))
                    .and(tUsersEventsTickets.eventId.equals(event.id))
                .executeUpdate();

            // TODO: Synchronise the existing ticket's information with the ticketing provider.
        }

        return;
    }

    if (!event.tickets?.enableAutoRevoke)
        return;

    const service = await createTicketService(event.id);
    if (!service || !service.capabilities.canCancelOrder)
        return;

    const ticketInfo = (await service.listVolunteerTickets(event.id, [ userId ])).get(userId);
    if (!ticketInfo || ticketInfo.cancelled)
        return;

    await dbInstance.deleteFrom(tUsersEventsTickets)
        .where(tUsersEventsTickets.userId.equals(userId))
            .and(tUsersEventsTickets.eventId.equals(event.id))
        .executeDelete();

    await CancelTicketTask.Schedule({
        event: event.slug,
        orderId: ticketInfo.purchaseId,
        reason: 'Cancellation',
    });

    LogBuilder.for('CancelVolunteerTicket')
        .withInitiatorUser(initiatorUserId)
        .withAffectedUser(userId)
        .withSeverity('Error')
        .record({
            event: event.shortName,
            purchaseId: ticketInfo.purchaseId,
        });
}
