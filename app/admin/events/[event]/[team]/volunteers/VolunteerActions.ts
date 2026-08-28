// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import type { CommunicationPromptId } from '@lib/ai/PromptFactory';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { executeServerAction } from '@lib/serverAction';
import { sendCommunication } from '@app/admin/components/CommunicationDialog/sendCommunication';
import db, { tEvents, tTeams, tUsersEvents } from '@lib/database';

/**
 * Returns context, sourced from the database, for a volunteer action with the following properties.
 */
async function getContextForVolunteerAction(userId: number, eventId: number, teamId: number) {
    const result = await db.selectFrom(tUsersEvents)
        .innerJoin(tEvents)
            .on(tEvents.eventId.equals(tUsersEvents.eventId))
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tUsersEvents.teamId))
        .where(tUsersEvents.userId.equals(userId))
            .and(tUsersEvents.eventId.equals(eventId))
            .and(tUsersEvents.teamId.equals(teamId))
        .select({
            event: {
                id: tEvents.eventId,

                festivalId: tEvents.eventFestivalId,
                shortName: tEvents.eventShortName,
                slug: tEvents.eventSlug,
                timezone: tEvents.eventTimezone,
            },
            team: {
                id: tTeams.teamId,
                slug: tTeams.teamSlug,
            },
        })
        .executeSelectNoneOrOne();

    if (!result)
        notFound();  // the given information cannot be validated

    return result;
}

/**
 * Server Action that will be invoked by the <CommunicationIconButton> component when a message
 * should be send on the user's behalf. All input should be treated as untrusted until verified.
 */
export async function sendCommunicationToVolunteer(
    eventId: number, teamId: number, recipientId: number, promptId: CommunicationPromptId,
    subject?: string, message?: string)
{
    return executeServerAction(new FormData(), z.object({ /* none */ }), async (data, props) => {
        const { event, team } = await getContextForVolunteerAction(recipientId, eventId, teamId);

        executeAccessCheck(props.authenticationContext, {
            permission: 'event.volunteers.information',
            operation: 'update',
            scope: {
                event: event.slug,
                team: team.slug,
            },
        });

        if (!subject || !message)
            return { success: false, error: 'Subject and/or message are missing from the request' };

        await sendCommunication({
            sender: props.user,
            recipient: recipientId,
            subject,
            message,
            metadata: {
                eventId,
                teamId,
                promptId,
            },
        });

        return {
            success: true,
            message: 'The e-mail has been sent, thank you for keeping them in the loop!',
        };
    });
}
