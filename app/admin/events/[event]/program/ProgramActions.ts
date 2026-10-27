// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { executeServerAction } from '@lib/serverAction';
import { sendCommunication } from '@app/admin/components/CommunicationDialog/sendCommunication';
import db, { tActivities, tActivitiesLogs, tEvents } from '@lib/database';

import { kMutation, kMutationSeverity } from '@lib/database/Types';

/**
 * Server Action that will be invoked by the <CommunicationIconButton> component when a message
 * should be sent to an activity's owner on the user's behalf.
 */
export async function sendCommunicationToActivityOwner(
    eventId: number, activityId: number, subject?: string, message?: string)
{
    return executeServerAction(new FormData(), z.object({ /* none */ }), async (data, props) => {
        const dbInstance = db;
        const context = await dbInstance.selectFrom(tEvents)
            .innerJoin(tActivities)
                .on(tActivities.activityFestivalId.equals(tEvents.eventFestivalId))
                    .and(tActivities.activityId.equals(activityId))
                    .and(tActivities.activityDeleted.isNull())
            .where(tEvents.eventId.equals(eventId))
            .select({
                event: {
                    id: tEvents.eventId,
                    festivalId: tEvents.eventFestivalId,
                    slug: tEvents.eventSlug,
                },
                activity: {
                    id: tActivities.activityId,
                    helpRequested: tActivities.activityHelpNeeded.equals(/* true= */ 1),
                    requestAssignee: tActivities.activityRequestAssignee,
                    reportToEmail: tActivities.activityReportToEmail,
                    reportToName: tActivities.activityReportToName,
                },
            })
            .executeSelectNoneOrOne();

        if (!context || !context.event.festivalId || !context.activity.reportToEmail ||
            !context.activity.reportToName)
        {
            notFound();
        }

        executeAccessCheck(props.authenticationContext, {
            permission: 'volunteers.program-requests',
            operation: 'update',
            scope: {
                event: context.event.slug,
            },
        });

        if (!subject || !message)
            return { success: false, error: 'Subject and/or message are missing from the request' };

        await sendCommunication({
            sender: props.user,
            recipient: context.activity.reportToEmail,
            subject,
            message,
            metadata: {
                eventId: context.event.id,
                promptId: 'program-activity-check-in',
            },
        });

        let mutationFields = 'contacted owner';

        // Auto-assign the help requested field to the |props.user| given that they've reached out
        // to the event owner. This optimises yet another human step away from the process.
        if (context.activity.helpRequested && !context.activity.requestAssignee) {
            await dbInstance.update(tActivities)
                .set({
                    activityRequestAssignee: props.user.id,
                })
                .where(tActivities.activityId.equals(activityId))
                    .and(tActivities.activityFestivalId.equals(context.event.festivalId))
                .executeUpdate();

            mutationFields = 'contacted owner, assignee';
        }

        await dbInstance.insertInto(tActivitiesLogs)
            .set({
                festivalId: context.event.festivalId,
                activityId: context.activity.id,
                mutation: kMutation.Updated,  // TODO: kMutation.Contacted
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
