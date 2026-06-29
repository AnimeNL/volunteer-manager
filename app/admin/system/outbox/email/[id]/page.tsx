// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import MailOutlinedIcon from '@mui/icons-material/MailOutlined';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

import { DetailedLogs } from './DetailedLogs';
import { KeyValueList } from '@app/admin/components/KeyValueList';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tOutboxEmail, tUsers } from '@lib/database';

/**
 * The message outbox page displays an individual message that was sent through the Volunteer
 * Manager. It includes all metainformation, including logs regarding the result.
 */
export default async function OutboxEmailPage(props: PageProps<'/admin/system/outbox/email/[id]'>) {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.internals.outbox',
    });

    const params = await props.params;
    const id = parseInt(params.id, 10);
    if (isNaN(id))
        notFound();

    const fromUserJoin = tUsers.forUseInLeftJoinAs('fuj');
    const toUserJoin = tUsers.forUseInLeftJoinAs('tuj');

    const dbInstance = db;
    const message = await dbInstance.selectFrom(tOutboxEmail)
        .leftJoin(fromUserJoin)
            .on(fromUserJoin.userId.equals(tOutboxEmail.outboxSenderUserId))
        .leftJoin(toUserJoin)
            .on(toUserJoin.userId.equals(tOutboxEmail.outboxToUserId))
        .select({
            // Basic fields:
            id: tOutboxEmail.outboxEmailId,
            date: dbInstance.dateTimeAsString(tOutboxEmail.outboxTimestamp),
            from: tOutboxEmail.outboxSender,
            fromUser: {
                id: fromUserJoin.userId,
                name: fromUserJoin.name,
            },
            to: tOutboxEmail.outboxTo,
            toUser: {
                id: toUserJoin.userId,
                name: toUserJoin.name,
            },
            subject: tOutboxEmail.outboxSubject,
            delivered:
                tOutboxEmail.outboxResultAccepted.length().greaterThan(0).valueWhenNull(false),

            // Detailed fields:
            cc: tOutboxEmail.outboxCc,
            bcc: tOutboxEmail.outboxBcc,

            headers: tOutboxEmail.outboxHeaders,

            // Message content:
            text: tOutboxEmail.outboxBodyText,
            html: tOutboxEmail.outboxBodyHtml,

            // Message logs:
            logs: tOutboxEmail.outboxLogs,

            // Message error:
            errorName: tOutboxEmail.outboxErrorName,
            errorMessage: tOutboxEmail.outboxErrorMessage,
            errorStack: tOutboxEmail.outboxErrorStack,
            errorCause: tOutboxEmail.outboxErrorCause,

            // Message result:
            messageId: tOutboxEmail.outboxResultMessageId,
            accepted: tOutboxEmail.outboxResultAccepted,
            rejected: tOutboxEmail.outboxResultRejected,
            pending: tOutboxEmail.outboxResultPending,
            response: tOutboxEmail.outboxResultResponse,
        })
        .where(tOutboxEmail.outboxEmailId.equals(id))
        .executeSelectNoneOrOne();

    if (!message)
        notFound();

    const logs = !!message.logs ? JSON.parse(message.logs) : [];

    return (
        <>
            <Section icon={ <MailOutlinedIcon color="primary" /> }
                        title={`E-mail message #${params.id}`}
                        breadcrumbs={[
                            { label: 'Communication', href: '/admin/system/communication' },
                            { label: 'Outbox' },
                            { label: 'E-mail', href: '/admin/system/outbox/email' },
                            { label: `#${params.id}` },
                        ]}>
                <SectionIntroduction>
                    Detailed information about a message we sent by e-mail.
                </SectionIntroduction>
            </Section>
            <Section title="Message">
                <KeyValueList items={[
                    {
                        key: 'Date',
                        value: message.date,
                        valueTemplate: 'localDateTime',
                    },
                    {
                        condition: !message.fromUser,
                        key: 'Sender',
                        value: message.from,
                    },
                    {
                        condition: !!message.fromUser,
                        key: 'Sender',
                        value: message.fromUser!,
                        valueTemplate: 'account',
                    },
                    {
                        condition: !!message.fromUser,
                        key: '⤷ e-mail address',
                        value: message.from,
                    },
                    {
                        condition: !message.toUser,
                        key: 'Recipient',
                        value: message.to,
                    },
                    {
                        condition: !!message.toUser,
                        key: 'Recipient',
                        value: message.toUser!,
                        valueTemplate: 'account',
                    },
                    {
                        condition: !!message.toUser,
                        key: '⤷ e-mail address',
                        value: message.to,
                    },
                    {
                        condition: !!message.cc,
                        key: 'Cc',
                        value: message.cc,
                    },
                    {
                        condition: !!message.bcc,
                        key: 'Bcc',
                        value: message.bcc,
                    },
                    {
                        key: 'Subject',
                        value: message.subject,
                    },
                    {
                        condition: !!message.headers && message.headers.length > 2,
                        key: 'Headers',
                        value: message.headers,
                        valueTemplate: 'monospace',
                    },
                ]} />
            </Section>
            <Grid container spacing={1.5} sx={{  }}>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Paper variant="outlined" sx={{ minHeight: '100%', padding: 2 }}>
                        <Typography variant="body2" sx={{
                            overflowWrap: 'anywhere',
                            whiteSpace: 'pre-wrap',
                        }}>
                            {message.text}
                        </Typography>
                    </Paper>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Paper variant="outlined" sx={{ minHeight: '100%', padding: 2 }}>
                        <Typography variant="body2" sx={{
                            overflowWrap: 'anywhere',
                            whiteSpace: 'pre-wrap',
                        }}>
                            {message.html}
                        </Typography>
                    </Paper>
                </Grid>
            </Grid>
            { !!message.errorName &&
                <Section noHeader>
                    <Alert severity="error">
                        An exception occurred when sending this message.
                    </Alert>
                    <KeyValueList items={[
                        {
                            key: 'Name',
                            value: message.errorName,
                        },
                        {
                            key: 'Message',
                            value: message.errorMessage,
                        },
                        {
                            condition: !!message.errorCause,
                            key: 'Cause',
                            value: message.errorCause,
                        },
                        {
                            key: 'Stack trace',
                            value: message.errorStack,
                            valueTemplate: 'monospace',
                        },
                    ]} />
                </Section> }
            { !!message.messageId &&
                <Section title="Delivery">
                    <KeyValueList items={[
                        {
                            key: 'Message ID',
                            value: message.messageId,
                        },
                        {
                            condition: !!message.accepted,
                            key: 'Accepted',
                            value: message.accepted,
                        },
                        {
                            condition: !!message.rejected,
                            key: 'Rejected',
                            value: message.rejected,
                        },
                        {
                            condition: !!message.pending,
                            key: 'Pending',
                            value: message.pending,
                        },
                        {
                            condition: !!message.response,
                            key: 'Response',
                            value: message.response,
                            valueTemplate: 'monospace',
                        },
                    ]} />
                </Section> }
            { !!logs.length && <DetailedLogs logs={logs} /> }
        </>
    );
}

export const metadata: Metadata = {
    title: 'E-mail message | Outbox | AnimeCon Volunteer Manager',
};
