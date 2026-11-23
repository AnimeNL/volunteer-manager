// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { executeServerAction } from '@lib/serverAction';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';
import { sendCommunication } from '@app/admin/components/CommunicationDialog/sendCommunication';
import db, { tActivities, tActivitiesLogs } from '@lib/database';

import { kMutation, kMutationSeverity } from '@lib/database/Types';

/**
 * Zod schema for the communication payload sent to an activity's owner.
 */
const kCommunicationData = z.object({
    subject: z.string().nonempty(),
    message: z.string().nonempty(),
});

/**
 * Server Action that will be invoked by the <CommunicationIconButton> component when a message
 * should be sent to an activity's owner on the user's behalf.
 */
export async function sendCommunicationToActivityOwner(
    eventId: number, activityId: number, subject?: string, message?: string)
{
    return executeServerAction({ subject, message }, kCommunicationData, async (data, props) => {
        const { event } = await requireAuthenticationWithEvent(
            props.authenticationContext, eventId, {
                permission: 'volunteers.program-requests',
                operation: 'update',
            });

        const festivalId = event.integrations?.anPlanFestivalId;
        if (!festivalId)
            notFound();

        const dbInstance = db;
        const activity = await dbInstance.selectFrom(tActivities)
            .where(tActivities.activityFestivalId.equals(festivalId))
                .and(tActivities.activityId.equals(activityId))
                .and(tActivities.activityDeleted.isNull())
            .select({
                id: tActivities.activityId,
                helpRequested: tActivities.activityHelpNeeded.equals(/* true= */ 1),
                requestAssignee: tActivities.activityRequestAssignee,
                reportToEmail: tActivities.activityReportToEmail,
                reportToName: tActivities.activityReportToName,
            })
            .executeSelectNoneOrOne();

        if (!activity || !activity.reportToEmail || !activity.reportToName)
            notFound();

        await sendCommunication({
            sender: props.user,
            recipient: activity.reportToEmail,
            subject: data.subject,
            message: data.message,
            metadata: {
                eventId: event.id,
                promptId: 'program-activity-check-in',
            },
        });

        let mutationFields: string | undefined;

        // Auto-assign the help requested field to the |props.user| given that they've reached out
        // to the event owner. This optimises yet another human step away from the process.
        if (activity.helpRequested && !activity.requestAssignee) {
            await dbInstance.update(tActivities)
                .set({
                    activityRequestAssignee: props.user.id,
                })
                .where(tActivities.activityId.equals(activityId))
                    .and(tActivities.activityFestivalId.equals(festivalId))
                .executeUpdate();

            mutationFields = 'assignee';
        }

        await dbInstance.insertInto(tActivitiesLogs)
            .set({
                festivalId,
                activityId: activity.id,
                mutation: kMutation.Contacted,
                mutationFields,
                mutationSeverity: kMutationSeverity.Important,
                mutationUserId: props.user.id,
                mutationDate: dbInstance.currentZonedDateTime(),
            })
            .executeInsert();

        return {
            success: true,
            refresh: true,
            message: 'The e-mail has been sent, thank you for keeping them in the loop!',
        };
    });
}
