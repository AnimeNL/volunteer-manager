// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { SelectElement, TextareaAutosizeElement } from '@components/proxy/react-hook-form-mui';

import FeedbackOutlinedIcon from '@mui/icons-material/FeedbackOutlined';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';

import { FormGridSection } from '@app/admin/components/FormGridSection';
import { KeyValueList } from '@app/admin/components/KeyValueList';
import { RecordLog, kLogType } from '@lib/Log';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '../../../lib/generatePageMetadata';
import { executeServerAction } from '@lib/serverAction';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tFeedback, tUsers } from '@lib/database';

import { kFeedbackResponse, type FeedbackResponse } from '@lib/database/Types';

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
async function recordResponse(feedbackId: number, feedbackUserId?: number, formData?: unknown) {
    'use server';
    return executeServerAction(formData, kRecordResponseData, async (data, props) => {
        await requireAuthenticationContext({
            check: 'admin',
            permission: 'organisation.feedback',
        });

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

        RecordLog({
            sourceUser: props.user,
            targetUser: feedbackUserId,
            type: kLogType.AdminFeedbackResponse,
            data,
        });

        return { success: true, refresh: true };
    });
}

/**
 * Options that may be selected for our response to a piece of feedback.
 */
const kResponseOptions: { id: FeedbackResponse, label: string }[] = [
    { id: kFeedbackResponse.Acknowledged, label: 'Acknowledged' },
    { id: kFeedbackResponse.Archived, label: 'Archived' },
    { id: kFeedbackResponse.Declined, label: 'Declined' },
    { id: kFeedbackResponse.Resolved, label: 'Resolved' },
];

/**
 * This page displays an individual piece of received feedback to the user. Display is trimmed by
 * default, so gaining access to the comprehensive feedback is important.
 */
export default async function FeedbackDetailPage(
    props: PageProps<'/admin/organisation/feedback/[id]'>)
{
    const { id } = await props.params;

    await requireAuthenticationContext({
        check: 'admin',
        permission: 'organisation.feedback',
    });

    const usersJoin = tUsers.forUseInLeftJoinAs('uj');
    const usersResponseJoin = tUsers.forUseInLeftJoinAs('urj');

    const dbInstance = db;
    const feedback = await dbInstance.selectFrom(tFeedback)
        .leftJoin(usersJoin)
            .on(usersJoin.userId.equals(tFeedback.userId))
        .leftJoin(usersResponseJoin)
            .on(usersResponseJoin.userId.equals(tFeedback.feedbackResponseUserId))
        .where(tFeedback.feedbackId.equals(parseInt(id, /* radix= */ 10)))
        .select({
            id: tFeedback.feedbackId,
            date: dbInstance.dateTimeAsString(tFeedback.feedbackDate),
            name: tFeedback.feedbackName,
            user: {
                id: usersJoin.userId,
                firstName: usersJoin.displayName.valueWhenNull(usersJoin.firstName),
                name: usersJoin.name,
            },
            feedback: tFeedback.feedbackText,

            response: tFeedback.feedbackResponse,
            responseDate: dbInstance.dateTimeAsString(tFeedback.feedbackResponseDate),
            responseText: tFeedback.feedbackResponseText,
            responseUser: {
                id: usersResponseJoin.userId,
                name: usersResponseJoin.name,
            },
        })
        .executeSelectNoneOrOne();

    if (!feedback)
        notFound();

    const action = recordResponse.bind(null, feedback.id, feedback.user?.id);
    const author = feedback.name || feedback.user?.firstName;

    const defaultValues = {
        response: feedback.response,
        responseText: feedback.responseText,
    };

    return (
        <>
            <Section icon={ <FeedbackOutlinedIcon color="primary" /> } title="Feedback"
                     breadcrumbs={[
                         { label: 'Organisation', href: '/admin/organisation' },
                         { label: 'Feedback', href: '/admin/organisation/feedback' },
                         { label: `${author} says…` },
                     ]}>
                <SectionIntroduction>
                    This page displays feedback received by one of our volunteers. Please consider
                    it and reach out to the volunteer to let them know what you think.
                </SectionIntroduction>
            </Section>
            <Section title={`${author} says…`}>
                <KeyValueList items={[
                    {
                        condition: !feedback.user,
                        key: 'Author',
                        value: feedback.name,
                    },
                    {
                        condition: !!feedback.user,
                        key: 'Author',
                        value: feedback.user!,
                        valueTemplate: 'account',
                    },
                    {
                        key: 'Received on',
                        value: feedback.date,
                        valueTemplate: 'localDateTime',
                    }
                ]} />
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                    {feedback.feedback}
                </Typography>
            </Section>
            <FormGridSection action={action} defaultValues={defaultValues}
                             title="Record our response">
                <Grid size={{ xs: 12 }}>
                    <SectionIntroduction>
                        It's important to keep track of how we respond to feedback, which you can
                        record here. Changes won't be shared with {feedback.user?.firstName}
                        —please let them know yourself.
                    </SectionIntroduction>
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <KeyValueList items={[
                        {
                            condition: !!feedback.responseUser,
                            key: 'Volunteer',
                            value: feedback.responseUser!,
                            valueTemplate: 'account',
                        },
                        {
                            condition: !!feedback.responseDate,
                            key: 'Responded on',
                            value: feedback.responseDate,
                            valueTemplate: 'localDateTime',
                        },
                        {
                            keyAlign: 'center',
                            key: 'Response',
                            value: (
                                <SelectElement name="response" fullWidth size="small"
                                               options={kResponseOptions} required />
                            ),
                        },
                        {
                            keyAlign: 'center',
                            key: 'Details',
                            value: (
                                <TextareaAutosizeElement name="responseText" fullWidth size="small"
                                                         required />
                            ),
                        },
                    ]} />
                </Grid>
            </FormGridSection>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('Feedback', 'Organisation');
