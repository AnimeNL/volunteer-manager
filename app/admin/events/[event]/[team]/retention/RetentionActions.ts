// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { LogBuilder } from '@lib/log/index';
import { executeServerAction } from '@lib/serverAction';
import { formatDate } from '@lib/Temporal';
import { sendCommunication } from '@app/admin/components/CommunicationDialog/sendCommunication';
import db, { tRetention, tUsers } from '@lib/database';

import { kRetentionStatus } from '@lib/database/Types';
import { requireAuthenticationWithEventAndTeam } from '@lib/requireAuthentication';

/**
 * Interface describing the payload for sending a WhatsApp message.
 */
const kSendRetentionWhatsAppSchema = z.object({
    /**
     * The WhatsApp message to send.
     */
    message: z.string().trim().min(1),
});

/**
 * Assigns the volunteer and records the outreach activity in the retention table.
 */
async function recordRetentionOutreach(
    eventId: number, teamId: number, recipientId: number, assigneeId: number,
    medium: 'e-mail' | 'WhatsApp')
{
    const noteDate = formatDate(Temporal.Now.instant(), 'MMMM Do');
    const noteNotes = medium === 'e-mail' ? `Sent an e-mail (${noteDate})`
                                          : `Sent a WhatsApp message (${noteDate})`;

    const affectedRows = await db.insertInto(tRetention)
        .set({
            userId: recipientId,
            eventId: eventId,
            teamId: teamId,
            retentionStatus: kRetentionStatus.Contacting,
            retentionAssigneeId: assigneeId,
            retentionNotes: noteNotes,
        })
        .onConflictDoUpdateSet({
            retentionStatus: kRetentionStatus.Contacting,
            retentionAssigneeId: assigneeId,
            retentionNotes: noteNotes,
        })
        .executeInsert();

    if (!affectedRows)
        throw new Error('Unable to assign this volunteer to you…');
}

/**
 * Server Action to send a retention e-mail reminder to a volunteer.
 */
export async function sendRetentionEmail(
    eventSlug: string, teamSlug: string, recipientId: number, subject?: string, message?: string)
{
    return executeServerAction(new FormData, z.object({ /* none */ }), async (data, props) => {
        const { event, team } = await requireAuthenticationWithEventAndTeam(eventSlug, teamSlug, {
            permission: 'volunteers.retention',
            operation: 'update',
        });

        const volunteer = await db.selectFrom(tUsers)
            .where(tUsers.userId.equals(recipientId))
            .select({
                emailAddress: tUsers.username,
                phoneNumber: tUsers.phoneNumber,
            })
            .executeSelectNoneOrOne();

        if (!event || !team || !volunteer)
            notFound();

        if (!subject || !message)
            return { success: false, error: 'Subject and/or message are missing from the request' };

        if (!volunteer.emailAddress)
            return { success: false, error: 'We don\'t have their e-mail address on file…' };

        await recordRetentionOutreach(event.id, team.id, recipientId, props.user.id, 'e-mail');
        await sendCommunication({
            sender: props.user,
            recipient: recipientId,
            subject,
            message,
            metadata: {
                eventId: event.id,
                teamId: team.id,
                promptId: 'participation-reminder',
            },
        });

        LogBuilder.for('RecordRetentionOutreach')
            .withInitiatorUser(props.user)
            .withAffectedUser(recipientId)
            .record({
                channel: 'e-mail',
                event: event.shortName,
            });

        return {
            success: true,
            message: 'The e-mail has been sent, thank you for keeping them in the loop!',
        };
    });
}

/**
 * Server Action that will be invoked when a WhatsApp reminder message was prepared.
 * It assigns the volunteer to the current user, writes a log entry, and returns
 * the target volunteer's phone number.
 */
export async function sendRetentionWhatsApp(
    eventSlug: string, teamSlug: string, recipientId: number, formData: unknown)
{
    return executeServerAction(formData, kSendRetentionWhatsAppSchema, async (data, props) => {
        const { event, team } = await requireAuthenticationWithEventAndTeam(eventSlug, teamSlug, {
            permission: 'volunteers.retention',
            operation: 'update',
        });

        const volunteer = await db.selectFrom(tUsers)
            .where(tUsers.userId.equals(recipientId))
            .select({
                emailAddress: tUsers.username,
                phoneNumber: tUsers.phoneNumber,
            })
            .executeSelectNoneOrOne();

        if (!event || !team || !volunteer)
            notFound();

        if (!volunteer.phoneNumber)
            return { success: false, error: 'We don\'t have their phone number on file…' };

        await recordRetentionOutreach(event.id, team.id, recipientId, props.user.id, 'WhatsApp');

        LogBuilder.for('RecordRetentionOutreach')
            .withInitiatorUser(props.user)
            .withAffectedUser(recipientId)
            .record({
                channel: 'WhatsApp',
                event: event.shortName,
            });

        return {
            success: true,
            phoneNumber: volunteer.phoneNumber,
        };
    });
}
