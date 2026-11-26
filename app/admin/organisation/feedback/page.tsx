// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import FeedbackOutlinedIcon from '@mui/icons-material/FeedbackOutlined';

import { DataTable, createDataSource, withRowModel, type Column, type ExtractRowModel }
    from '@app/admin/components/DataTable';
import { ResponseCell, ResponseHeader } from './ResponseCell';
import { Section } from '../../components/Section';
import { SectionIntroduction } from '../../components/SectionIntroduction';
import { createGenerateMetadataFn } from '../../lib/generatePageMetadata';
import { requireAuthentication } from '@lib/auth';
import db, { tFeedback, tUsers } from '@lib/database';

import { kFeedbackResponse } from '@lib/database/Types';

/**
 * Data source through which the feedback logs can be retrieved.
 */
const feedbackDataSource = createDataSource('organisation/feedback', withRowModel({
    /**
     * Unique ID of the feedback entry.
     */
    id: z.number(),

    /**
     * Date and time at which the feedback was received, in UTC.
     */
    date: z.string(),

    /**
     * Volunteer who submitted the feedback, if authenticated.
     */
    user: z.object({
        id: z.number().optional(),
        name: z.string(),
    }),

    /**
     * The feedback message.
     */
    feedback: z.string(),

    /**
     * Volunteer to whom this feedback has been assigned, if any.
     */
    assignedTo: z.object({
        id: z.number(),
        name: z.string(),
    }).optional(),

    /**
     * Our response to the feedback.
     */
    response: z.enum(kFeedbackResponse).optional(),

}), {
    async authorize(operation, props) {
        await requireAuthentication(props.authenticationContext, 'organisation.feedback');
    },

    async list(params, props) {
        const usersJoin = tUsers.forUseInLeftJoinAs('uj');
        const usersAssignedJoin = tUsers.forUseInLeftJoinAs('uaj');

        const dbInstance = db;
        const results = await dbInstance.selectFrom(tFeedback)
            .leftJoin(usersJoin)
                .on(usersJoin.userId.equals(tFeedback.userId))
            .leftJoin(usersAssignedJoin)
                .on(usersAssignedJoin.userId.equals(tFeedback.feedbackAssignedUserId))
            .where(
                usersJoin.name.containsInsensitiveIfValue(params.search).or(
                usersAssignedJoin.name.containsInsensitiveIfValue(params.search).or(
                tFeedback.feedbackName.containsInsensitiveIfValue(params.search).or(
                tFeedback.feedbackText.containsInsensitiveIfValue(params.search)
            ))))
            .select({
                id: tFeedback.feedbackId,
                date: dbInstance.dateTimeAsString(tFeedback.feedbackDate),
                user: {
                    id: tFeedback.userId,
                    name: usersJoin.name.valueWhenNull(tFeedback.feedbackName)
                        .valueWhenNull('Unknown'),
                },
                feedback: tFeedback.feedbackText,
                assignedTo: {
                    id: usersAssignedJoin.userId,
                    name: usersAssignedJoin.name,
                },
                response: tFeedback.feedbackResponse,
            })
            .orderBy(
                params.sort.field === 'user' ? 'user.name'
                    : params.sort.field === 'assignedTo' ? 'assignedTo.name'
                    : params.sort.field === 'feedback' ? 'feedback'
                    : 'date',
                params.sort.direction)
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        return {
            rowCount: results.count,
            rows: results.data.map(row => ({
                ...row,
                user: {
                    id: row.user.id ?? undefined,
                    name: row.user.name,
                },
                assignedTo: row.assignedTo?.id ? {
                    id: row.assignedTo.id,
                    name: row.assignedTo.name,
                } : undefined,
                response: row.response ?? undefined,
            })),
        };
    },
});

/**
 * Page that lists feedback received through the Volunteer Manager. All feedback is read-only, and
 * cannot be actioned or acknowledged directly from the portal.
 */
export default async function FeedbackPage() {
    await requireAuthentication('organisation.feedback');

    const columns: Column<ExtractRowModel<typeof feedbackDataSource>>[] = [
        {
            field: 'date',
            headerName: 'Received',
            width: 185,

            template: 'date',
            templateProps: {
                format: 'YYYY-MM-DD HH:mm:ss',
                href: './feedback/{id}',
            },
        },
        {
            field: 'user',
            headerName: 'Volunteer',
            flex: 1,

            template: 'account',
        },
        {
            field: 'feedback',
            headerName: 'Feedback',

            flex: 3,
        },
        {
            field: 'assignedTo',
            headerName: 'Assigned to',
            flex: 1,

            template: 'account',
            templateProps: {
                noAccountLabel: 'Unassigned',
            },
        },
        {
            display: 'flex',
            field: 'response',
            headerAlign: 'center',
            headerName: '',
            sortable: false,
            align: 'center',
            width: 50,

            template: 'component',
            templateProps: {
                headerComponent: ResponseHeader,
                component: ResponseCell,
            },
        }
    ];

    return (
        <>
            <Section icon={ <FeedbackOutlinedIcon color="primary" /> } title="Feedback" breadcrumbs={[
                { label: 'Organisation', href: '/admin/organisation' },
                { label: 'Feedback' },
            ]}>
                <SectionIntroduction>
                    This page lists feedback received from volunteers via the Volunteer Portal. Entries
                    are attributed to the volunteer, and cannot be updated or removed.
                </SectionIntroduction>
            </Section>
            <Section noHeader>
                <DataTable
                    columns={columns}
                    source={feedbackDataSource}
                    defaultSort={{ field: 'date', sort: 'desc' }}
                    pageSize={50}
                    listViewProps={{
                        primaryField: 'user.name',
                        secondaryField: 'feedback',
                        dateField: 'date',
                        dateFieldFormat: 'YYYY-MM-DD HH:mm:ss',
                        startComponent: ResponseCell,
                        linkTemplate: './feedback/{id}',
                    }}
                />
            </Section>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('Feedback', 'Organisation');
