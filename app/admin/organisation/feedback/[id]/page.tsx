// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import { SelectElement, TextareaAutosizeElement } from '@components/proxy/react-hook-form-mui';

import AssignmentIndOutlinedIcon from '@mui/icons-material/AssignmentIndOutlined';
import FeedbackOutlinedIcon from '@mui/icons-material/FeedbackOutlined';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';

import { FormGridSection } from '@app/admin/components/FormGridSection';
import { KeyValueList } from '@app/admin/components/KeyValueList';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '../../../lib/generatePageMetadata';
import { queryUsersWithPermission } from '@app/admin/lib/queryUsersWithPermission';
import { requireAuthentication } from '@lib/auth';
import db, { tFeedback, tUsers } from '@lib/database';

import { kFeedbackResponse, type FeedbackResponse } from '@lib/database/Types';

import { assignFeedback, recordResponse } from './FeedbackActions';

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

    await requireAuthentication('organisation.feedback');

    const feedbackId = parseInt(id, /* radix= */ 10);
    if (!Number.isSafeInteger(feedbackId))
        notFound();

    const usersJoin = tUsers.forUseInLeftJoinAs('uj');
    const usersAssignedJoin = tUsers.forUseInLeftJoinAs('uaj');
    const usersResponseJoin = tUsers.forUseInLeftJoinAs('urj');

    const dbInstance = db;
    const [ feedback, eligibleUsers ] = await Promise.all([
        dbInstance.selectFrom(tFeedback)
            .leftJoin(usersJoin)
                .on(usersJoin.userId.equals(tFeedback.userId))
            .leftJoin(usersAssignedJoin)
                .on(usersAssignedJoin.userId.equals(tFeedback.feedbackAssignedUserId))
            .leftJoin(usersResponseJoin)
                .on(usersResponseJoin.userId.equals(tFeedback.feedbackResponseUserId))
            .where(tFeedback.feedbackId.equals(feedbackId))
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

                assignedUser: {
                    id: usersAssignedJoin.userId,
                    name: usersAssignedJoin.name,
                },

                response: tFeedback.feedbackResponse,
                responseDate: dbInstance.dateTimeAsString(tFeedback.feedbackResponseDate),
                responseText: tFeedback.feedbackResponseText,
                responseUser: {
                    id: usersResponseJoin.userId,
                    name: usersResponseJoin.name,
                },
            })
            .executeSelectNoneOrOne(),
        queryUsersWithPermission('organisation.feedback'),
    ]);

    if (!feedback)
        notFound();

    const assignAction = assignFeedback.bind(null, feedback.id);
    const responseAction = recordResponse.bind(null, feedback.id, feedback.user?.id);
    const author = feedback.name || feedback.user?.firstName;

    const assigneeOptions = [
        ...eligibleUsers.map(user => ({ id: user.id, label: user.name })),
    ];
    if (feedback.assignedUser?.id &&
            !assigneeOptions.some(option => option.id === feedback.assignedUser?.id)) {
        assigneeOptions.push({
            id: feedback.assignedUser.id,
            label: feedback.assignedUser.name,
        });
    }
    assigneeOptions.sort((lhs, rhs) => lhs.label.localeCompare(rhs.label));
    assigneeOptions.unshift({ id: 0, label: 'Unassigned' });

    const assignDefaultValues = {
        assignedUserId: feedback.assignedUser?.id ?? 0,
    };

    const responseDefaultValues = {
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
                        condition: !feedback.user?.id,
                        key: 'Author',
                        value: feedback.name,
                    },
                    {
                        condition: !!feedback.user?.id,
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
            <FormGridSection action={assignAction} defaultValues={assignDefaultValues}
                             icon={ <AssignmentIndOutlinedIcon /> } title="Assign feedback">
                <Grid size={{ xs: 12 }}>
                    <SectionIntroduction>
                        Assign this feedback to a volunteer to follow up on. Assigned feedback
                        without a recorded response will be highlighted on their dashboard.
                    </SectionIntroduction>
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <KeyValueList items={[
                        {
                            keyAlign: 'center',
                            key: 'Assigned to',
                            value: (
                                <SelectElement name="assignedUserId" fullWidth size="small"
                                               options={assigneeOptions} />
                            ),
                            valueTemplate: 'component',
                        },
                    ]} />
                </Grid>
            </FormGridSection>
            <FormGridSection action={responseAction} defaultValues={responseDefaultValues}
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
                            condition: !!feedback.responseUser?.id,
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
                            valueTemplate: 'component',
                        },
                        {
                            keyAlign: 'center',
                            key: 'Details',
                            value: (
                                <TextareaAutosizeElement name="responseText" fullWidth size="small"
                                                         required />
                            ),
                            valueTemplate: 'component',
                        },
                    ]} />
                </Grid>
            </FormGridSection>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('Feedback', 'Organisation');
