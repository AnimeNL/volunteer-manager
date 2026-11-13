// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';

import type { Column, ExtractRowModel } from '@app/admin/components/DataTable';
import { DataTable, createDataSource, withContext, withRowModel } from '@app/admin/components/DataTable';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { SynchronizeInboxAction } from './SynchronizeInboxAction';
import { ThreadStateCell, ThreadStateHeader } from '../InboxCells';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { queryInboxAssignees, requireInboxAccess } from '../InboxAccess';
import { requireAuthentication } from '@lib/requireAuthentication';
import db, { tInboxEmail, tInboxThreads, tUsers } from '@lib/database';

import { synchronizeInbox } from '../InboxActions';

/**
 * Data source through which inbound e-mail threads for a specific account can be retrieved.
 */
const inboxThreadsDataSource = createDataSource('admin/system/inbox/threads', withContext({
    /**
     * Unique ID of the inbound e-mail account (`email_accounts.email_account_id`).
     */
    accountId: z.number(),

    /**
     * Timestamp of the latest IMAP synchronisation, included so `router.refresh()` invalidates and
     * reloads the table after a manual synchronisation.
     */
    lastSynced: z.string().nullable(),

}), withRowModel({
    /**
     * Unique ID of the thread (`inbox_threads.inbox_thread_id`).
     */
    id: z.number(),

    /**
     * Whether the thread has been resolved ("Done") or is still pending a response.
     */
    resolved: z.boolean(),

    /**
     * Person the thread is with, linked to their portal account when matched.
     */
    sender: z.object({
        id: z.number().optional(),
        name: z.string(),
    }),

    /**
     * Eligible volunteer with read access to this inbox assigned to the thread, if any.
     */
    assignee: z.object({
        id: z.number(),
        name: z.string(),
    }).optional(),

    /**
     * Normalised subject of the thread.
     */
    subject: z.string(),

    /**
     * Date and time of the latest message in the thread, in UTC.
     */
    latestDate: z.string(),

}), {
    async authorize(_operation, props, context) {
        const authContext = await requireAuthentication(
            props.authenticationContext, 'system.inbox.eligible');

        await requireInboxAccess(authContext, context.accountId, 'read');
    },

    async list(params, _props, context) {
        const eligibleAssignees = await queryInboxAssignees(context.accountId);
        const eligibleAssigneeIds = eligibleAssignees.map(assignee => assignee.id);

        const senderUserJoin = tUsers.forUseInLeftJoinAs('su');
        const assigneeUserJoin = tUsers.forUseInLeftJoinAs('au');

        const dbInstance = db;
        const search = params.search?.trim() || undefined;

        const matchingEmailsSubquery = dbInstance.selectFrom(tInboxEmail)
            .where(tInboxEmail.emailAccountId.equals(context.accountId))
                .and(tInboxEmail.inboxDeleted.isNull())
                .and(
                    tInboxEmail.inboxSubject.containsInsensitiveIfValue(search).or(
                    tInboxEmail.inboxFromName.containsInsensitiveIfValue(search)).or(
                    tInboxEmail.inboxFromAddress.containsInsensitiveIfValue(search)).or(
                    tInboxEmail.inboxBodyText.containsInsensitiveIfValue(search)))
            .selectOneColumn(tInboxEmail.inboxThreadId);

        let sortField: 'resolved' | 'sender.name' | 'assignee.name' | 'subject' | 'latestDate';
        switch (params.sort.field) {
            case 'resolved':
            case 'subject':
                sortField = params.sort.field;
                break;

            case 'sender':
                sortField = 'sender.name';
                break;

            case 'assignee':
                sortField = 'assignee.name';
                break;

            default:
                sortField = 'latestDate';
                break;
        }

        const query = dbInstance.selectFrom(tInboxThreads)
            .leftJoin(senderUserJoin)
                .on(senderUserJoin.userId.equals(tInboxThreads.threadFromUserId))
                    .and(senderUserJoin.anonymized.isNull())
            .leftJoin(assigneeUserJoin)
                .on(assigneeUserJoin.userId.equals(tInboxThreads.threadAssigneeUserId))
                    .and(eligibleAssigneeIds.length > 0
                        ? assigneeUserJoin.userId.in(eligibleAssigneeIds)
                        : dbInstance.false())
            .where(tInboxThreads.emailAccountId.equals(context.accountId))
                .and(tInboxThreads.threadDeleted.isNull())
                .and(
                    tInboxThreads.threadSubject.containsInsensitiveIfValue(search).or(
                    tInboxThreads.threadFromName.containsInsensitiveIfValue(search)).or(
                    tInboxThreads.threadFromAddress.containsInsensitiveIfValue(search)).or(
                    senderUserJoin.name.containsInsensitiveIfValue(search)).or(
                    assigneeUserJoin.name.containsInsensitiveIfValue(search)).or(
                    tInboxThreads.inboxThreadId.in(matchingEmailsSubquery).onlyWhen(!!search)))
            .select({
                id: tInboxThreads.inboxThreadId,
                resolved: tInboxThreads.threadResolved.isNotNull(),
                sender: {
                    id: senderUserJoin.userId,
                    name: senderUserJoin.name
                        .valueWhenNull(tInboxThreads.threadFromName.nullIfValue(''))
                        .valueWhenNull(tInboxThreads.threadFromAddress.nullIfValue(''))
                        .valueWhenNull('Unknown'),
                },
                assignee: {
                    id: assigneeUserJoin.userId,
                    name: assigneeUserJoin.name,
                },
                subject: tInboxThreads.threadSubject,
                latestDate: dbInstance.dateTimeAsString(tInboxThreads.threadLatestDate),
            })
            .orderBy('resolved', sortField === 'resolved' ? params.sort.direction : 'asc');

        if (sortField !== 'resolved')
            query.orderBy(sortField, params.sort.direction);

        if (sortField !== 'latestDate')
            query.orderBy('latestDate', 'desc');

        const results = await query
            .orderBy('id', 'desc')
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        return {
            rowCount: results.count,
            rows: results.data.map(row => ({
                ...row,
                subject: row.subject || '(no subject)',
            })),
        };
    },
});

/**
 * Page displaying the inbox for an individual inbound e-mail account.
 */
export default async function EmailInboxPage(props: PageProps<'/admin/system/inbox/[id]'>) {
    const context = await requireAuthentication('system.inbox.eligible');
    const params = await props.params;
    const account = await requireInboxAccess(context, params.id, 'read');

    const threadLinkTemplate = `/admin/system/inbox/${account.id}/{id}`;

    const columns: Column<ExtractRowModel<typeof inboxThreadsDataSource>>[] = [
        {
            display: 'flex',
            field: 'resolved',
            headerAlign: 'center',
            headerName: '',
            align: 'center',
            sortable: true,
            width: 50,

            template: 'component',
            templateProps: {
                headerComponent: ThreadStateHeader,
                component: ThreadStateCell,
            },
        },
        {
            field: 'sender',
            headerName: 'Sender',
            sortable: true,
            flex: 1.5,

            template: 'account',
        },
        {
            field: 'assignee',
            headerName: 'Assignee',
            sortable: true,
            flex: 1.5,

            template: 'account',
            templateProps: {
                noAccountLabel: 'Unassigned',
            },
        },
        {
            field: 'subject',
            headerName: 'Subject',
            sortable: true,
            flex: 3,

            template: 'text',
            templateProps: {
                href: threadLinkTemplate,
            },
        },
        {
            field: 'latestDate',
            headerName: 'Latest message',
            sortable: true,
            width: 185,

            template: 'date',
            templateProps: {
                format: 'YYYY-MM-DD HH:mm:ss',
            },
        },
    ];

    const headerAction = (
        <SynchronizeInboxAction action={ synchronizeInbox.bind(null, account.id) } />
    );

    return (
        <>
            <Section icon={ <InboxOutlinedIcon color="primary" /> } title={account.address}
                     headerAction={headerAction}
                     breadcrumbs={[
                         { label: 'E-mail' },
                         { label: account.address },
                     ]}>
                <SectionIntroduction>
                    Incoming messages received for the <strong>{account.address}</strong> e-mail
                    account.
                </SectionIntroduction>
            </Section>
            <Section noHeader>
                <DataTable
                    columns={columns}
                    source={inboxThreadsDataSource}
                    context={{ accountId: account.id, lastSynced: account.lastSynced ?? null }}
                    defaultSort={{ field: 'latestDate', sort: 'desc' }}
                    pageSize={50}
                    search="prominent"
                    subject="thread"
                    listViewProps={{
                        startComponent: ThreadStateCell,
                        primaryField: 'sender.name',
                        secondaryField: 'subject',
                        dateField: 'latestDate',
                        dateFieldFormat: 'YYYY-MM-DD',
                        linkTemplate: threadLinkTemplate,
                    }} />
            </Section>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn({ emailAccount: 'id' }, 'E-mail');
