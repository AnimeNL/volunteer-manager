// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import MailOutlinedIcon from '@mui/icons-material/MailOutlined';

import { OutboxDataTable } from '../OutboxDataTable';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createDataSource, withRowModel } from '@app/admin/components/DataTable';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { requireAuthentication } from '@lib/requireAuthentication';
import db, { tOutboxEmail, tUsers } from '@lib/database';

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
    message: z.string(),

    /**
     * Whether the message was successfully accepted/delivered.
     */
    delivered: z.boolean(),

}), {
    async authorize(operation, props) {
        executeAccessCheck(props.authenticationContext, 'system.internals.outbox');
    },

    async list(params, props) {
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

        const usersJoinForRecipient = tUsers.forUseInLeftJoinAs('ujfr');
        const usersJoinForSender = tUsers.forUseInLeftJoinAs('ujfs');

        const dbInstance = db;
        const messages = await dbInstance.selectFrom(tOutboxEmail)
            .leftJoin(usersJoinForRecipient)
                .on(usersJoinForRecipient.userId.equals(tOutboxEmail.outboxToUserId))
            .leftJoin(usersJoinForSender)
                .on(usersJoinForSender.userId.equals(tOutboxEmail.outboxSenderUserId))
                    .and(usersJoinForSender.userId.notEquals(tOutboxEmail.outboxToUserId))
            .where(
                tOutboxEmail.outboxSender.containsInsensitiveIfValue(params.search).or(
                tOutboxEmail.outboxTo.containsInsensitiveIfValue(params.search).or(
                tOutboxEmail.outboxSubject.containsInsensitiveIfValue(params.search).or(
                usersJoinForRecipient.name.containsInsensitiveIfValue(params.search).or(
                usersJoinForSender.name.containsInsensitiveIfValue(params.search)
            )))))
            .select({
                id: tOutboxEmail.outboxEmailId,
                date: dbInstance.dateTimeAsString(tOutboxEmail.outboxTimestamp),
                sender: {
                    id: tOutboxEmail.outboxSenderUserId,
                    name: usersJoinForSender.name.valueWhenNull(tOutboxEmail.outboxSender),
                },
                recipient: {
                    id: tOutboxEmail.outboxToUserId,
                    name: usersJoinForRecipient.name.valueWhenNull(tOutboxEmail.outboxTo),
                },
                message: tOutboxEmail.outboxSubject,
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
    await requireAuthentication('system.internals.outbox');

    return (
        <>
            <Section icon={ <MailOutlinedIcon color="primary" /> } title="E-mail outbox"
                     breadcrumbs={[
                         { label: 'Communication', href: '/admin/system/communication' },
                         { label: 'Outbox', href: '/admin/system/outbox' },
                         { label: 'E-mail' },
                     ]}>
                <SectionIntroduction>
                    These are e-mail messages that were sent through the portal.
                </SectionIntroduction>
            </Section>
            <Section tabs noHeader>
                <OutboxDataTable type="Email" source={emailDataSource} />
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('E-mail', 'Outbox', 'Communication');
