// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';

import { KeyValueList } from '@app/admin/components/KeyValueList';
import { Section } from '@app/admin/components/Section';
import { type TwilioOutboxType, kTwilioOutboxType } from '@lib/database/Types';
import { WebhookDataTable } from '../webhooks/WebhookDataTable';
import db, { tOutboxTwilio, tUsers } from '@lib/database';

/**
 * Props accepted by the <TwilioDetailsPage> component.
 */
interface TwilioDetailsPageProps {
    /**
     * Type of message details should be shown for.
     */
    type: TwilioOutboxType;

    /**
     * Unique ID of the message that should be detailed.
     */
    id: number;
}

/**
 * The <TwilioDetailsPage> component displays a detail page listing all information known about a
 * particular Twilio message in the outbox.
 */
export async function TwilioDetailsPage(props: TwilioDetailsPageProps) {
    const recipientUserJoin = tUsers.forUseInLeftJoinAs('ruj');
    const senderUserJoin = tUsers.forUseInLeftJoinAs('suj');

    const dbInstance = db;
    const message = await dbInstance.selectFrom(tOutboxTwilio)
        .leftJoin(senderUserJoin)
            .on(senderUserJoin.userId.equals(tOutboxTwilio.outboxSenderUserId))
        .leftJoin(recipientUserJoin)
            .on(recipientUserJoin.userId.equals(tOutboxTwilio.outboxRecipientUserId))
        .where(tOutboxTwilio.outboxType.equals(props.type))
            .and(tOutboxTwilio.outboxTwilioId.equals(props.id))
        .select({
            date: tOutboxTwilio.outboxTimestamp,
            sender: {
                name: tOutboxTwilio.outboxSender,
                user: {
                    id: senderUserJoin.userId,
                    name: senderUserJoin.name,
                },
            },
            recipient: {
                name: tOutboxTwilio.outboxRecipient,
                user: {
                    id: recipientUserJoin.userId,
                    name: recipientUserJoin.name,
                },
            },
            message: tOutboxTwilio.outboxMessage,
            error: {
                code: tOutboxTwilio.outboxResultErrorCode,
                message: tOutboxTwilio.outboxResultErrorMessage,
            },
            exception: {
                name: tOutboxTwilio.outboxErrorName,
                cause: tOutboxTwilio.outboxErrorCause,
                message: tOutboxTwilio.outboxErrorMessage,
                stack: tOutboxTwilio.outboxErrorStack,
            },
            result: {
                status: tOutboxTwilio.outboxResultStatus,
                sid: tOutboxTwilio.outboxResultSid,
                time: tOutboxTwilio.outboxResultTime,
            },
        })
        .executeSelectNoneOrOne();

    if (!message)
        notFound();

    return (
        <>
            <Section title="Message">
                <KeyValueList items={[
                    {
                        key: 'Date',
                        value: message.date.toString(),
                        valueTemplate: 'localDateTime',
                    },
                    {
                        condition: !message.sender.name,
                        key: 'Sender',
                        value: 'Unknown',
                    },
                    {
                        condition: !!message.sender.user,
                        key: 'Sender',
                        value: message.sender.user!,
                        valueTemplate: 'account',
                    },
                    {
                        condition: !!message.sender.name,
                        key: '⤷ phone number',
                        value: message.sender.name,
                    },
                    {
                        condition: !!message.recipient.user,
                        key: 'Recipient',
                        value: message.recipient.user!,
                        valueTemplate: 'account',
                    },
                    {
                        key: '⤷ phone number',
                        value: message.recipient.name,
                    },
                    {
                        condition: props.type === kTwilioOutboxType.WhatsApp,
                        key: '',
                        value: (
                            <Typography variant="body2" color="error">
                                WhatsApp messages are based on templates stored in Twilio, so the
                                message shown below may not be immediately useful.
                            </Typography>
                        ),
                        valueTemplate: 'component',
                    },
                    {
                        key: 'Message',
                        value: message.message,
                    },
                ]} />
            </Section>
            { !!message.error &&
                <Section noHeader>
                    <Alert severity="error">
                        An error occurred when sending this message.
                    </Alert>
                    <KeyValueList items={[
                        {
                            key: 'Error code',
                            value: message.error.code,
                        },
                        {
                            key: 'Error message',
                            value: message.error.message,
                        }
                    ]} />
                </Section> }
            { !!message.exception &&
                <Section noHeader>
                    <Alert severity="error">
                        An exception occurred when sending this message.
                    </Alert>
                    <KeyValueList items={[
                        {
                            key: 'Name',
                            value: message.exception.name,
                        },
                        {
                            key: 'Message',
                            value: message.exception.message,
                        },
                        {
                            condition: !!message.exception.cause,
                            key: 'Cause',
                            value: message.exception.cause,
                        },
                        {
                            key: 'Stack trace',
                            value: message.exception.stack,
                            valueTemplate: 'monospace',
                        },
                    ]} />
                </Section> }
            { !!message.result &&
                <Section title="Delivery">
                    <KeyValueList items={[
                        {
                            key: 'Status',
                            value: message.result.status,
                        },
                        {
                            condition: !!message.result.sid,
                            key: 'SID',
                            value: message.result.sid,
                        },
                        {
                            key: 'Time',
                            value: `${message.result.time}ms`,
                        }
                    ]} />
                </Section> }
            { !!message.result && !!message.result.sid &&
                <Section title="Associated webhooks">
                    <WebhookDataTable twilioMessageSid={message.result.sid} />
                </Section> }
        </>
    );
}
