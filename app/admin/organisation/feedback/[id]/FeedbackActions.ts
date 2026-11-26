// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { z } from 'zod/v4';

import { LogBuilder } from '@lib/log';
import { executeServerAction } from '@lib/serverAction';
import { queryUsersWithPermission } from '@app/admin/lib/queryUsersWithPermission';
import { requireAuthentication } from '@lib/auth';
import db, { tFeedback } from '@lib/database';

import { kFeedbackResponse } from '@lib/database/Types';

/**
 * Zod type that describes the data required when assigning a piece of feedback to a volunteer.
 */
const kAssignFeedbackData = z.object({
    assignedUserId: z.union([
        z.number().int().nonnegative(),
        z.literal(''),
        z.null(),
    ]).optional().transform(value => (typeof value === 'number' && value > 0) ? value : null),
});

/**
 * Server action that assigns or unassigns a piece of feedback to an eligible volunteer.
 */
export async function assignFeedback(feedbackId: number, formData: unknown) {
    return executeServerAction(formData, kAssignFeedbackData, async (data, props) => {
        await requireAuthentication(props.authenticationContext, 'organisation.feedback');

        let assignee: { id: number; name: string } | undefined;
        if (data.assignedUserId !== null) {
            const eligibleUsers = await queryUsersWithPermission('organisation.feedback');
            assignee = eligibleUsers.find(user => user.id === data.assignedUserId);
            if (!assignee) {
                return {
                    success: false,
                    error: 'The selected volunteer cannot be assigned to feedback…',
                };
            }
        }

        const affectedRows = await db.update(tFeedback)
            .set({
                feedbackAssignedUserId: assignee?.id ?? null,
            })
            .where(tFeedback.feedbackId.equals(feedbackId))
            .executeUpdate();

        if (!affectedRows)
            return { success: false, error: 'Unable to update the assignment in the database…' };

        LogBuilder.for('AssignFeedback')
            .withInitiatorUser(props.user)
            .withAffectedUser(assignee?.id)
            .record({
                assignee: assignee?.name,
                id: feedbackId,
            });

        return { success: true, refresh: true };
    });
}

/**
 * Zod type that describes the data required when recording the response to a piece of feedback.
 */
const kRecordResponseData = z.object({
    response: z.enum(kFeedbackResponse),
    responseText: z.string(),
});

/**
 * Server action that can be used to record our response to a piece of feedback.
 */
export async function recordResponse(
    feedbackId: number, feedbackUserId?: number, formData?: unknown)
{
    return executeServerAction(formData, kRecordResponseData, async (data, props) => {
        await requireAuthentication(props.authenticationContext, 'organisation.feedback');

        const dbInstance = db;
        const affectedRows = await dbInstance.update(tFeedback)
            .set({
                feedbackResponse: data.response,
                feedbackResponseDate: dbInstance.currentZonedDateTime(),
                feedbackResponseText: data.responseText,
                feedbackResponseUserId: props.user.id,
            })
            .where(tFeedback.feedbackId.equals(feedbackId))
            .executeUpdate();

        if (!affectedRows)
            return { success: false, error: 'Unable to store the response in the database…' };

        LogBuilder.for('RespondToFeedback')
            .withInitiatorUser(props.user)
            .withAffectedUser(feedbackUserId)
            .record({ action: data.response });

        return { success: true, refresh: true };
    });
}
