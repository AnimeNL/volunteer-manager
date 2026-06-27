// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';
import { z } from 'zod/v4';

import { DataTable, createDataSource, withRowModel, type Column, type ExtractRowModel }
    from '@app/admin/components/DataTable';
import { MessageDeliveredCell } from '../OutboxRowComponents';
import { requireAuthenticationContext, executeAccessCheck } from '@lib/auth/AuthenticationContext';
import db, { tOutboxEmail } from '@lib/database';

/**
 * Data source through which the email outbox list can be populated.
 */
const emailDataSource = createDataSource('admin/system/outbox/email', withRowModel({
    /**
     * Unique ID of this message.
     */
    id: z.number(),

    /**
     * Date and time at which the message was sent, in UTC.
     */
    date: z.string(),

    /**
     * Name and, if available, user ID of the person who sent the message.
     */
    sender: z.object({
        id: z.number().optional(),
        name: z.string(),
    }),

    /**
     * Name and, if available, user ID of the person who received the message.
     */
    recipient: z.object({
        id: z.number().optional(),
        name: z.string(),
    }),

    /**
     * The subject of the email.
     */
    subject: z.string(),

    /**
     * Whether the message was successfully accepted/delivered.
     */
    delivered: z.boolean(),

}), {
    async authorize(operation, props) {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin',
            permission: 'system.internals.outbox',
        });
    },

    async list(params, props) {
        let sortField: 'id' | 'date' | 'sender.name' | 'recipient.name' | 'subject' | 'delivered'
            = 'date';

        switch (params.sort.field) {
            case 'id':
            case 'date':
            case 'subject':
            case 'delivered':
                sortField = params.sort.field as 'id' | 'date' | 'subject' | 'delivered';
                break;

            case 'sender':
                sortField = 'sender.name';
                break;

            case 'recipient':
                sortField = 'recipient.name';
                break;
        }

        const dbInstance = db;
        const messages = await dbInstance.selectFrom(tOutboxEmail)
            .where(
                tOutboxEmail.outboxSender.containsInsensitiveIfValue(params.search).or(
                tOutboxEmail.outboxTo.containsInsensitiveIfValue(params.search).or(
                tOutboxEmail.outboxSubject.containsInsensitiveIfValue(params.search)
            )))
            .select({
                id: tOutboxEmail.outboxEmailId,
                date: dbInstance.dateTimeAsString(tOutboxEmail.outboxTimestamp),
                sender: {
                    id: tOutboxEmail.outboxSenderUserId,
                    name: tOutboxEmail.outboxSender,
                },
                recipient: {
                    id: tOutboxEmail.outboxToUserId,
                    name: tOutboxEmail.outboxTo,
                },
                subject: tOutboxEmail.outboxSubject,
                delivered: tOutboxEmail.outboxResultAccepted.length().greaterThan(0)
                    .valueWhenNull(false),
            })
            .orderBy(sortField, params.sort.direction)
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        return {
            rowCount: messages.count,
            rows: messages.data,
        };
    },
});

/**
 * The outbox page summarises all outgoing e-mail messages, and tells the volunteer whether they
 * have been successfully sent or ran into an issue somewhere. This page is only available to those
 * with specific permissions, as messages may contain e.g. password reset links.
 */
export default async function OutboxEmailPage() {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.internals.outbox',
    });

    const columns: Column<ExtractRowModel<typeof emailDataSource>>[] = [
        {
            field: 'date',
            headerName: 'Date',
            width: 185,

            template: 'date',
            templateProps: {
                format: 'YYYY-MM-DD HH:mm:ss',
                href: '/admin/system/outbox/email/{id}',
            },
        },
        {
            field: 'sender',
            headerName: 'Sender',
            flex: 2,

            template: 'account',
        },
        {
            field: 'recipient',
            headerName: 'Recipient',
            flex: 2,

            template: 'account',
        },
        {
            field: 'subject',
            headerName: 'Subject',
            flex: 3,

            template: 'text',
            templateProps: {
                href: '/admin/system/outbox/email/{id}',
            },
        },
        {
            field: 'delivered',
            display: 'flex',
            headerName: 'Accepted',
            headerAlign: 'center',
            align: 'center',
            description: 'Whether the e-mail was accepted by the server',
            sortable: true,
            width: 100,

            template: 'component',
            templateProps: {
                component: MessageDeliveredCell,
            },
        },
    ];

    return (
        <DataTable columns={columns} source={emailDataSource}
                   defaultSort={{ field: 'date', sort: 'desc' }}
                   pageSize={50}
                   listViewProps={{
                       primaryField: 'sender.name',
                       secondaryTemplate: '› {recipient.name} ({subject})',
                       dateField: 'date',
                       dateFieldFormat: 'YYYY-MM-DD',
                       startComponent: MessageDeliveredCell,
                       linkTemplate: '/admin/system/outbox/email/{id}',
                   }} />
    );
}

export const metadata: Metadata = {
    title: 'E-mail | Outbox | AnimeCon Volunteer Manager',
};
