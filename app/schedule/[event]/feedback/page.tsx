// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import { FeedbackPage } from './FeedbackPage';
import { generateScheduleMetadataFn } from '../lib/generateScheduleMetadataFn';
import { getEventBySlug } from '@lib/EventLoader';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tFeedback, tUsers } from '@lib/database';

/**
 * The <FeedbackServerPage> component lists the feedback given by the signed in user, including our
 * responses when they are available.
 */
export default async function FeedbackServerPage(props: PageProps<'/schedule/[event]/feedback'>) {
    const params = await props.params;

    const { user } = await requireAuthenticationContext({
        check: 'event',
        event: params.event
    });

    const event = await getEventBySlug(params.event);
    if (!event)
        notFound();

    const usersJoin = tUsers.forUseInLeftJoin();

    const dbInstance = db;
    const feedback = await dbInstance.selectFrom(tFeedback)
        .leftJoin(usersJoin)
            .on(usersJoin.userId.equals(tFeedback.feedbackResponseUserId))
        .where(tFeedback.userId.equals(user.id))
        .select({
            id: tFeedback.feedbackId,
            feedback: {
                date: dbInstance.dateTimeAsString(tFeedback.feedbackDate),
                text: tFeedback.feedbackText,
            },
            response: {
                author: usersJoin.name,
                date: dbInstance.dateTimeAsString(tFeedback.feedbackResponseDate),
                text: tFeedback.feedbackResponseText,
            },
        })
        .orderBy('feedback.date', 'desc')
        .executeSelectMany();

    return <FeedbackPage feedback={feedback} timezone={event.timezone} />;
}

export const generateMetadata = generateScheduleMetadataFn([ 'Feedback' ]);
