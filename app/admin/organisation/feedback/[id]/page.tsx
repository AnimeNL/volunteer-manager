// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';
import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { SelectElement, TextareaAutosizeElement } from '@components/proxy/react-hook-form-mui';

import { default as MuiLink } from '@mui/material/Link';
import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import { FormGridSection } from '@app/admin/components/FormGridSection';
import { LocalDateTime } from '@app/admin/components/LocalDateTime';
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
                id: tFeedback.feedbackResponseUserId,
                name: usersResponseJoin.name,
            },
        })
        .executeSelectNoneOrOne();

    if (!feedback)
        notFound();

    const action = recordResponse.bind(null, feedback.id, feedback.user?.id);
    const author = feedback.name || feedback.user?.name;

    const defaultValues = {
        response: feedback.response,
        responseText: feedback.responseText,
    };

    return (
        <>
            <Section title="Feedback" subtitle={author}>
                <SectionIntroduction>
                    This page displays feedback received by one of our volunteers. Please consider
                    it and reach out to the volunteer to let them know what you think.
                </SectionIntroduction>
                <Table sx={{ mt: '0px !important' }}>
                    <TableBody>
                        <TableRow>
                            <TableCell width="25%" component="th" scope="row">Author</TableCell>
                            <TableCell>
                                { !feedback.user && feedback.name }
                                { !!feedback.user &&
                                    <MuiLink
                                        component={Link}
                                        href={`/admin/organisation/accounts/${feedback.user.id}`}>
                                        {feedback.user.name}
                                    </MuiLink> }
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell width="25%" component="th" scope="row">Date</TableCell>
                            <TableCell>
                                <LocalDateTime dateTime={feedback.date}
                                               format="YYYY-MM-DD HH:mm:ss" />
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
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
                    <Table sx={{ mt: '-16px !important' }}>
                        <TableBody>
                            { !!feedback.responseUser &&
                                <TableRow>
                                    <TableCell width="25%" component="th" scope="row">
                                        Volunteer
                                    </TableCell>
                                    <TableCell>
                                        <MuiLink component={Link}
                                                 href={'/admin/organisation/accounts/' +
                                                           `${feedback.responseUser.id}`}>
                                            {feedback.responseUser.name}
                                        </MuiLink>
                                    </TableCell>
                                </TableRow> }
                            { !!feedback.responseDate &&
                                <TableRow>
                                    <TableCell width="25%" component="th" scope="row">
                                        Date
                                    </TableCell>
                                    <TableCell>
                                        <LocalDateTime dateTime={feedback.responseDate}
                                                       format="YYYY-MM-DD HH:mm:ss" />
                                    </TableCell>
                                </TableRow> }
                            <TableRow>
                                <TableCell width="25%" component="th" scope="row">
                                    Response
                                </TableCell>
                                <TableCell>
                                    <SelectElement name="response" label="Response" fullWidth
                                                   size="small" options={kResponseOptions}
                                                   required />
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell width="25%" component="th" scope="row">
                                    Details
                                </TableCell>
                                <TableCell>
                                    <TextareaAutosizeElement name="responseText" label="Reasoning"
                                                             fullWidth size="small" required />
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </Grid>

            </FormGridSection>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('Feedback', 'Organisation');
