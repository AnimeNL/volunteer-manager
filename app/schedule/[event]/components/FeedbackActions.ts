// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { z } from 'zod/v4';

import { LogBuilder } from '@lib/log/index';
import { executeServerAction } from '@lib/serverAction';
import { requireVolunteerAuthentication } from '@lib/requireAuthentication';
import db, { tFeedback } from '@lib/database';

/**
 * Zod type that describes the data required when submitting feedback.
 */
const kSubmitFeedbackData = z.object({
    /**
     * Feedback that should be considered for next year's team.
     */
    feedback: z.string().min(8),
});

/**
 * Server Action through which a volunteer is able to submit feedback.
 */
export async function submitFeedback(formData: unknown) {
    return executeServerAction(formData, kSubmitFeedbackData, async (data, props) => {
        await requireVolunteerAuthentication(props.authenticationContext);

        const dbInstance = db;
        const insertId = await dbInstance.insertInto(tFeedback)
            .set({
                userId: props.user.id,
                feedbackDate: dbInstance.currentZonedDateTime(),
                feedbackText: data.feedback,
            })
            .returningLastInsertedId()
            .executeInsert();

        LogBuilder.for('SubmitFeedback')
            .withCondition(!!insertId)
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                id: insertId,
            });

        return {
            success: !!insertId,
        };
    });
}
