// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import MailOutlinedIcon from '@mui/icons-material/MailOutlined';
import Typography from '@mui/material/Typography';

import type { ComposeEmailDefaultValues } from '../../ComposeEmailSection';
import type { EmailMessageAttachment } from './EmailMessageBody';
import { ComposeEmailSection } from '../../ComposeEmailSection';
import { EmailMessageBody } from './EmailMessageBody';
import { InlineAccountLink } from '@app/admin/components/InlineAccountLink';
import { KeyValueList } from '@app/admin/components/KeyValueList';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { ThreadStateActionBar } from './ThreadStateActionBar';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthentication } from '@lib/auth';
import { requireInboxAccess } from '../../InboxAccess';
import db, { tInboxEmail, tInboxEmailAttachments, tInboxThreads, tUsers } from '@lib/database';

import { sendInboxThreadReply, updateInboxThreadState } from '../../InboxActions';

/**
 * Represents a single JSON-stored e-mail address entry on `inbox_email`.
 */
interface StoredEmailAddress {
    name?: string;
    address?: string;
}

/**
 * Builds the pre-populated compose fields (`recipient`, `cc`, `subject`) for replying to `thread`.
 */
function buildReplyDefaultValues(
    accountAddress: string,
    thread: {
        subject: string;
        fromAddress: string;
        sender: { name: string };
    },
    messages: {
        fromAddress: string;
        sender: { name: string };
        cc?: string | null;
        replyTo?: string | null;
        subject: string;
    }[]): ComposeEmailDefaultValues
{
    const normalizedAccount = accountAddress.trim().toLowerCase();
    const latestInboundMessage = [ ...messages ].reverse().find(
        message => message.fromAddress.trim().toLowerCase() !== normalizedAccount);

    let recipient: string | undefined;
    let primaryRecipientAddress: string | undefined;

    const replyToEntry = parseStoredAddresses(latestInboundMessage?.replyTo).find(entry => {
        const candidate = entry.address?.trim().toLowerCase();
        return !!candidate && candidate !== normalizedAccount;
    });

    if (replyToEntry?.address) {
        primaryRecipientAddress = replyToEntry.address.trim().toLowerCase();
        recipient = formatAddressEntry(replyToEntry);
    } else if (latestInboundMessage?.fromAddress.trim()) {
        const address = latestInboundMessage.fromAddress.trim();
        primaryRecipientAddress = address.toLowerCase();
        recipient = formatAddressEntry({
            name: latestInboundMessage.sender.name !== 'Unknown'
                ? latestInboundMessage.sender.name
                : undefined,
            address,
        });
    } else if (thread.fromAddress.trim()) {
        const address = thread.fromAddress.trim();
        primaryRecipientAddress = address.toLowerCase();
        recipient = formatAddressEntry({
            name: thread.sender.name !== 'Unknown' ? thread.sender.name : undefined,
            address,
        });
    }

    const latestMessage = messages.at(-1);
    const ccAddresses = parseStoredAddresses(latestMessage?.cc)
        .filter(entry => {
            const candidate = entry.address?.trim().toLowerCase();
            return !!candidate && candidate !== normalizedAccount
                && candidate !== primaryRecipientAddress;
        })
        .map(formatAddressEntry)
        .filter(Boolean);

    const rawSubject = thread.subject.trim() || latestMessage?.subject.trim() || '';
    const subject = rawSubject
        ? (/^re\s*:/i.test(rawSubject) ? rawSubject : `Re: ${rawSubject}`)
        : '';

    return {
        recipient,
        cc: ccAddresses.length > 0 ? ccAddresses.join(', ') : undefined,
        subject,
    };
}

/**
 * Formats a single `StoredEmailAddress` into `Name <address>` or `address`.
 */
function formatAddressEntry(entry: StoredEmailAddress): string {
    const name = entry.name?.trim();
    const address = entry.address?.trim();
    if (name && address && name !== address)
        return `${name} <${address}>`;

    return address || name || '';
}

/**
 * Formats a JSON-encoded list of e-mail addresses (`Array<{ name?: string; address?: string }>`)
 * into a comma-separated string. When `senderAddress` is supplied, returns `undefined` unless at
 * least one entry differs from `senderAddress`.
 */
function formatAddresses(rawAddresses?: string | null, senderAddress?: string): string | undefined {
    const entries = parseStoredAddresses(rawAddresses);
    if (entries.length === 0)
        return undefined;

    if (senderAddress) {
        const normalizedSender = senderAddress.trim().toLowerCase();
        const hasDistinctAddress = entries.some(
            entry => entry.address?.trim().toLowerCase() !== normalizedSender);

        if (!hasDistinctAddress)
            return undefined;
    }

    const formatted = entries.map(formatAddressEntry).filter(Boolean);
    return formatted.length > 0 ? formatted.join(', ') : undefined;
}

/**
 * Safely parses a JSON-encoded list of `StoredEmailAddress` entries.
 */
function parseStoredAddresses(rawAddresses?: string | null): StoredEmailAddress[] {
    if (!rawAddresses)
        return [];

    try {
        const parsed = JSON.parse(rawAddresses);
        if (!Array.isArray(parsed))
            return [];

        return parsed.filter(
            (entry): entry is StoredEmailAddress => !!entry && typeof entry === 'object');
    } catch {
        return [];
    }
}

/**
 * Page displaying an individual inbound e-mail thread.
 */
export default async function EmailInboxThreadPage(
    props: PageProps<'/admin/system/inbox/[id]/[thread]'>)
{
    const context = await requireAuthentication('system.inbox.eligible');
    const params = await props.params;
    const account = await requireInboxAccess(context, params.id, 'read');

    const threadId = parseInt(params.thread, /* radix= */ 10);
    if (!Number.isSafeInteger(threadId))
        notFound();

    const senderUserJoin = tUsers.forUseInLeftJoinAs('tsu');
    const messageSenderJoin = tUsers.forUseInLeftJoinAs('msu');

    const dbInstance = db;
    const thread = await dbInstance.selectFrom(tInboxThreads)
        .leftJoin(senderUserJoin)
            .on(senderUserJoin.userId.equals(tInboxThreads.threadFromUserId))
                .and(senderUserJoin.anonymized.isNull())
        .where(tInboxThreads.inboxThreadId.equals(threadId))
            .and(tInboxThreads.emailAccountId.equals(account.id))
            .and(tInboxThreads.threadDeleted.isNull())
        .select({
            id: tInboxThreads.inboxThreadId,
            subject: tInboxThreads.threadSubject,
            resolvedDate: dbInstance.dateTimeAsString(tInboxThreads.threadResolved),
            fromAddress: tInboxThreads.threadFromAddress,
            sender: {
                id: senderUserJoin.userId,
                name: senderUserJoin.name
                    .valueWhenNull(tInboxThreads.threadFromName.nullIfValue(''))
                    .valueWhenNull(tInboxThreads.threadFromAddress.nullIfValue(''))
                    .valueWhenNull('Unknown'),
            },
        })
        .executeSelectNoneOrOne();

    if (!thread)
        notFound();

    const messages = await dbInstance.selectFrom(tInboxEmail)
        .leftJoin(messageSenderJoin)
            .on(messageSenderJoin.userId.equals(tInboxEmail.inboxFromUserId))
                .and(messageSenderJoin.anonymized.isNull())
        .where(tInboxEmail.emailAccountId.equals(account.id))
            .and(tInboxEmail.inboxThreadId.equals(thread.id))
            .and(tInboxEmail.inboxDeleted.isNull())
        .select({
            id: tInboxEmail.inboxEmailId,
            receivedDate: dbInstance.dateTimeAsString(tInboxEmail.inboxReceivedDate),
            fromAddress: tInboxEmail.inboxFromAddress,
            sender: {
                id: messageSenderJoin.userId,
                name: messageSenderJoin.name
                    .valueWhenNull(tInboxEmail.inboxFromName.nullIfValue(''))
                    .valueWhenNull(tInboxEmail.inboxFromAddress.nullIfValue(''))
                    .valueWhenNull('Unknown'),
            },
            to: tInboxEmail.inboxTo,
            cc: tInboxEmail.inboxCc,
            replyTo: tInboxEmail.inboxReplyTo,
            subject: tInboxEmail.inboxSubject,
            text: tInboxEmail.inboxBodyText,
            html: tInboxEmail.inboxBodyHtml,
        })
        .orderBy(tInboxEmail.inboxReceivedDate, 'asc')
        .orderBy(tInboxEmail.inboxEmailId, 'asc')
        .executeSelectMany();

    const attachmentsByEmailId = new Map<number, EmailMessageAttachment[]>();
    if (messages.length > 0) {
        const messageIds = messages.map(message => message.id);
        const attachments = await dbInstance.selectFrom(tInboxEmailAttachments)
            .where(tInboxEmailAttachments.inboxEmailId.in(messageIds))
            .select({
                id: tInboxEmailAttachments.inboxAttachmentId,
                emailId: tInboxEmailAttachments.inboxEmailId,
                filename: tInboxEmailAttachments.attachmentFilename,
                hasData: tInboxEmailAttachments.attachmentData.isNotNull(),
                size: tInboxEmailAttachments.attachmentSize,
            })
            .orderBy(tInboxEmailAttachments.inboxAttachmentId, 'asc')
            .executeSelectMany();

        for (const attachment of attachments) {
            const list = attachmentsByEmailId.get(attachment.emailId) ?? [];
            list.push({
                id: attachment.id,
                filename: attachment.filename?.trim() || `attachment-${attachment.id}`,
                size: attachment.size,
                downloadUrl: attachment.hasData
                    ? `/admin/system/inbox/${account.id}/${thread.id}/attachments/${attachment.id}`
                    : undefined,
            });

            attachmentsByEmailId.set(attachment.emailId, list);
        }
    }

    const subject = thread.subject || '(no subject)';
    const toggleAction = account.permissions.create
        ? updateInboxThreadState.bind(null, account.id, thread.id)
        : undefined;
    const replyDefaultValues = buildReplyDefaultValues(account.address, thread, messages);

    return (
        <>
            <Section icon={ <InboxOutlinedIcon color="primary" /> } title={subject}
                     breadcrumbs={[
                         { label: 'E-mail' },
                         { label: account.address, href: `/admin/system/inbox/${account.id}` },
                         { label: `#${thread.id}` },
                     ]}>
                <SectionIntroduction>
                    Conversation with <InlineAccountLink user={thread.sender} /> in the{' '}
                    <strong>{account.address}</strong> inbox.
                </SectionIntroduction>
                <ThreadStateActionBar action={toggleAction} resolvedDate={thread.resolvedDate} />
            </Section>
            { messages.length === 0 &&
                <Section noHeader>
                    <Typography color="text.secondary" variant="body2">
                        There are no messages in this thread.
                    </Typography>
                </Section> }
            { messages.map(message => {
                const hasDistinctAddress =
                    !!message.fromAddress && message.fromAddress !== message.sender.name;
                const toFormatted = formatAddresses(message.to);
                const ccFormatted = formatAddresses(message.cc);
                const replyToFormatted = formatAddresses(message.replyTo, message.fromAddress);
                const messageSubject = message.subject || '(no subject)';

                return (
                    <Section key={message.id} icon={ <MailOutlinedIcon /> } title={messageSubject}>
                        <KeyValueList items={[
                            {
                                key: 'Date',
                                value: message.receivedDate,
                                valueTemplate: 'localDateTime',
                            },
                            {
                                key: 'From',
                                value: (
                                    <>
                                        <InlineAccountLink user={message.sender} />
                                        { hasDistinctAddress && ` <${message.fromAddress}>` }
                                    </>
                                ),
                            },
                            {
                                condition: !!toFormatted,
                                key: 'To',
                                value: toFormatted,
                            },
                            {
                                condition: !!ccFormatted,
                                key: 'Cc',
                                value: ccFormatted,
                            },
                            {
                                condition: !!replyToFormatted,
                                key: 'Reply-To',
                                value: replyToFormatted,
                            },
                        ]} />
                        <EmailMessageBody
                            attachments={attachmentsByEmailId.get(message.id)}
                            html={message.html} text={message.text}
                            title={`Message #${message.id} from ${message.sender.name}`} />
                    </Section>
                );
            }) }
            { account.permissions.create &&
                <ComposeEmailSection
                    action={ sendInboxThreadReply.bind(null, account.id, thread.id) }
                    defaultValues={replyDefaultValues}
                    title="Reply to thread" /> }
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn(
    { inboxThread: 'thread' }, { emailAccount: 'id' }, 'E-mail');
