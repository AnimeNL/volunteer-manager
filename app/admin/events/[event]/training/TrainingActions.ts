// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import type { CommunicationPromptId } from '@lib/ai/PromptFactory';
import { LogBuilder } from '@lib/log/index';
import { executeServerAction } from '@lib/serverAction';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';
import { sendCommunication } from '@app/admin/components/CommunicationDialog/sendCommunication';
import db, { tEvents, tTrainingsAssignments, tUsersEvents } from '@lib/database';

import { kTemporalZonedDateTime } from '@app/admin/lib/ZodTransformers';

/**
 * The data associated with a training configuration update.
 */
const kTrainingConfigurationData = z.object({
    /**
     * Whether training information should be published on the registration portal.
     */
    trainingInformationPublished: z.coerce.number(),

    /**
     * Moment in time, if any, at which we'll start to accept training preferences.
     */
    trainingPreferencesStart: kTemporalZonedDateTime.nullish(),

    /**
     * Moment in time, if any, at which we'll no longer accept training preferences.
     */
    trainingPreferencesEnd: kTemporalZonedDateTime.nullish(),
});

/**
 * Server Action that will be invoked by the <CommunicationDialog> component when a training
 * confirmation or reminder message should be sent on the user's behalf.
 */
export async function sendTrainingConfirmationCommunication(
    eventSlug: string, recipientId: number, teamId: number, promptId: CommunicationPromptId,
    subject?: string, message?: string)
{
    return executeServerAction(new FormData(), z.object({ /* none */ }), async (data, props) => {
        const { event } = await requireAuthenticationWithEvent(
            props.authenticationContext, eventSlug, 'event.trainings');

        if (!event.flags.enableTraining || !recipientId || !teamId)
            notFound();

        const assignment = await db.selectFrom(tTrainingsAssignments)
            .innerJoin(tUsersEvents)
                .on(tUsersEvents.eventId.equals(tTrainingsAssignments.eventId))
                    .and(tUsersEvents.userId.equals(recipientId))
                    .and(tUsersEvents.teamId.equals(teamId))
            .where(tTrainingsAssignments.eventId.equals(event.id))
                .and(tTrainingsAssignments.assignmentUserId.equals(recipientId))
                .and(tTrainingsAssignments.assignmentTrainingId.isNotNull())
            .select({
                teamId: tUsersEvents.teamId,
            })
            .executeSelectNoneOrOne();

        if (!assignment)
            notFound();

        if (!subject || !message)
            return { success: false, error: 'Subject and/or message are missing from the request' };

        await sendCommunication({
            sender: props.user,
            recipient: recipientId,
            subject,
            message,
            metadata: {
                eventId: event.id,
                teamId: assignment.teamId,
                promptId,
            },
        });

        return {
            success: true,
            refresh: true,
            message: 'The e-mail has been sent, thank you for keeping them in the loop!',
        };
    });
}

/**
 * Server Action that will be invoked when the training configuration is being updated by a senior
 * volunteer. Synchronises the state update request with the database.
 */
export async function updateTrainingConfiguration(eventSlug: string, formData: unknown) {
    return executeServerAction(formData, kTrainingConfigurationData, async (data, props) => {
        const { event } = await requireAuthenticationWithEvent(
            props.authenticationContext, eventSlug, 'event.trainings');

        if (!event.flags.enableTraining)
            notFound();

        const affectedRows = await db.update(tEvents)
            .set({
                trainingInformationPublished: data.trainingInformationPublished,
                trainingPreferencesStart: data.trainingPreferencesStart,
                trainingPreferencesEnd: data.trainingPreferencesEnd,
            })
            .where(tEvents.eventId.equals(event.id))
            .executeUpdate();

        LogBuilder.for('UpdateEventPublishedInformation')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                event: event.shortName,
                published: !!data.trainingInformationPublished ? 'Published' : 'Unpublished',
                type: 'training',
            });

        return { success: true };
    });
}
