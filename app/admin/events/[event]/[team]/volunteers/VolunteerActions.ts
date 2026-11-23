// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import type { CommunicationPromptId } from '@lib/ai/PromptFactory';
import { executeServerAction } from '@lib/serverAction';
import { requireAuthenticationWithEventAndTeam } from '@lib/requireAuthentication';
import { sendCommunication } from '@app/admin/components/CommunicationDialog/sendCommunication';
import db, { tUsersEvents } from '@lib/database';

/**
 * Zod schema for the communication payload sent to a volunteer.
 */
const kCommunicationData = z.object({
    subject: z.string().nonempty(),
    message: z.string().nonempty(),
});

/**
 * Server Action that will be invoked by the <CommunicationIconButton> component when a message
 * should be sent on the user's behalf. All input should be treated as untrusted until verified.
 */
export async function sendCommunicationToVolunteer(
    eventId: number, teamId: number, recipientId: number, promptId: CommunicationPromptId,
    subject?: string, message?: string)
{
    return executeServerAction({ subject, message }, kCommunicationData, async (data, props) => {
        const { event, team } = await requireAuthenticationWithEventAndTeam(
            props.authenticationContext, eventId, teamId, {
                permission: 'volunteers.participation',
                operation: 'update',
            });

        const volunteer = await db.selectFrom(tUsersEvents)
            .where(tUsersEvents.userId.equals(recipientId))
                .and(tUsersEvents.eventId.equals(event.id))
                .and(tUsersEvents.teamId.equals(team.id))
            .selectOneColumn(tUsersEvents.userId)
            .executeSelectNoneOrOne();

        if (!volunteer)
            notFound();

        await sendCommunication({
            sender: props.user,
            recipient: recipientId,
            subject: data.subject,
            message: data.message,
            metadata: {
                eventId: event.id,
                teamId: team.id,
                promptId,
            },
        });

        return {
            success: true,
            message: 'The e-mail has been sent, thank you for keeping them in the loop!',
        };
    });
}
