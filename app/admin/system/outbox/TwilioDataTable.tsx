// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import { DataTable, createDataSource, withContext, withRowModel, type Column, type ExtractRowModel }
    from '@app/admin/components/DataTable';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import db, { tOutboxTwilio, tUsers } from '@lib/database';

import { type TwilioOutboxType, kTwilioOutboxType } from '@lib/database/Types';
import { MessageDeliveredCell } from './OutboxRowComponents';

/**
 * Data source through which the Twilio outbox lists can be populated.
 */
const twilioDataSource = createDataSource('admin/system/outbox/twilio', withContext({
    /**
     * Type of message that should be considered for this data source.
     */
    type: z.enum(kTwilioOutboxType),

}), withRowModel({
    /**
     * Unique ID of this message.
     */
    id: z.number(),

    /**
     * Date and time at which the message was sent, in UTC.
     */
    date: z.string(),

    /**
     * Name and, if available, user ID of the person who sent the message. The name may be missing
     * when we haven't received acknowledgement from Twilio yet.
     */
    sender: z.object({
        name: z.string(),
        userId: z.number().optional(),
    }),

    /**
     * Name and user ID of the person who received the message.
     */
    recipient: z.object({
        name: z.string(),
        id: z.number(),
    }),

    /**
     * The message that was sent to the recipient.
     */
    message: z.string(),

    /**
     * Whether the message was successfully delivered.
     */
    delivered: z.boolean(),

}), {
    async authorize(operation, props) {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin',
            permission: 'system.internals.outbox',
        });
    },

    async list(params, props, context) {
        let sortField: 'id' | 'date' | 'sender.name' | 'recipient.name' | 'message' | 'delivered'
            = 'date';

        switch (params.sort.field) {
            case 'id':
            case 'date':
            case 'message':
            case 'delivered':
                sortField = params.sort.field as 'id' | 'date' | 'message' | 'delivered';
                break;

            case 'sender':
                sortField = 'sender.name';
                break;

            case 'recipient':
                sortField = 'recipient.name';
                break;
        }

        const usersJoinForSender = tUsers.forUseInLeftJoinAs('ujfs');

        const dbInstance = db;
        const messages = await dbInstance.selectFrom(tOutboxTwilio)
            .innerJoin(tUsers)
                .on(tUsers.userId.equals(tOutboxTwilio.outboxRecipientUserId))
            .leftJoin(usersJoinForSender)
                .on(usersJoinForSender.userId.equals(tOutboxTwilio.outboxSenderUserId))
            .where(tOutboxTwilio.outboxType.equals(context.type))
                .and(
                    tOutboxTwilio.outboxMessage.containsInsensitiveIfValue(params.search).or(
                    tOutboxTwilio.outboxSender.containsInsensitiveIfValue(params.search).or(
                    tUsers.name.containsInsensitiveIfValue(params.search).or(
                    usersJoinForSender.name.containsInsensitiveIfValue(params.search)
                ))))
            .select({
                id: tOutboxTwilio.outboxTwilioId,
                date: dbInstance.dateTimeAsString(tOutboxTwilio.outboxTimestamp),
                sender: {
                    id: tOutboxTwilio.outboxSenderUserId,
                    name: usersJoinForSender.name.valueWhenNull(tOutboxTwilio.outboxSender)
                                                 .valueWhenNull(/* default= */ 'AnimeCon'),
                },
                recipient: {
                    id: tOutboxTwilio.outboxRecipientUserId,
                    name: tUsers.name,
                },
                message: tOutboxTwilio.outboxMessage,
                delivered: tOutboxTwilio.outboxResultStatus.in([ 'delivered', 'read', 'sent' ])
                    .valueWhenNull(dbInstance.false()),
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
 * Props accepted by the <TwilioDataTable> component.
 */
interface TwilioDataTableProps {
    /**
     * Type of messages that the data table should consider.
     */
    type: TwilioOutboxType;
}

/**
 * The <TwilioDataTable> component displays a DataTable showing Twilio outbox entries.
 */
export function TwilioDataTable(props: TwilioDataTableProps) {
    const typeLower = props.type.toLowerCase();
    const columns: Column<ExtractRowModel<typeof twilioDataSource>>[] = [
        {
            field: 'date',
            headerName: 'Date',
            width: 185,

            template: 'date',
            templateProps: {
                format: 'YYYY-MM-DD HH:mm:ss',
                href: `/admin/system/outbox/${typeLower}/{id}`,
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
            field: 'message',
            headerName: 'Message',
            flex: 3,
        },
        {
            field: 'delivered',
            display: 'flex',
            headerName: 'Delivered',
            headerAlign: 'center',
            align: 'center',
            description: 'Whether the message was successfully delivered',
            sortable: true,
            width: 100,

            template: 'component',
            templateProps: {
                component: MessageDeliveredCell,
            },
        },
    ];

    return (
        <DataTable columns={columns} source={twilioDataSource}
                   context={{ type: props.type }}
                   defaultSort={{ field: 'date', sort: 'desc' }}
                   pageSize={50}
                   listViewProps={{
                       primaryField: 'sender.name',
                       secondaryTemplate: '› {recipient.name} ({message})',
                       dateField: 'date',
                       dateFieldFormat: 'YYYY-MM-DD',
                       startComponent: MessageDeliveredCell,
                       linkTemplate: `/admin/system/outbox/${typeLower}/{id}`,
                   }} />
    );
}
