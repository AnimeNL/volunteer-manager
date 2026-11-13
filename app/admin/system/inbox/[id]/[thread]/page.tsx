// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import MailOutlinedIcon from '@mui/icons-material/MailOutlined';
import Typography from '@mui/material/Typography';

import type { EmailMessageAttachment } from './EmailMessageBody';
import { EmailMessageBody } from './EmailMessageBody';
import { InlineAccountLink } from '@app/admin/components/InlineAccountLink';
import { KeyValueList } from '@app/admin/components/KeyValueList';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { ThreadStateActionBar } from './ThreadStateActionBar';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthentication } from '@lib/requireAuthentication';
import { requireInboxAccess } from '../../InboxAccess';
import db, { tInboxEmail, tInboxEmailAttachments, tInboxThreads, tUsers } from '@lib/database';

import { updateInboxThreadState } from '../../InboxActions';

/**
 * Formats a JSON-encoded list of e-mail addresses (`Array<{ name?: string; address?: string }>`)
 * into a comma-separated string. When `senderAddress` is supplied, returns `undefined` unless at
 * least one entry differs from `senderAddress`.
 */
function formatAddresses(rawAddresses?: string | null, senderAddress?: string): string | undefined {
    if (!rawAddresses)
        return undefined;

    let entries: { name?: string; address?: string }[];
    try {
        const parsed = JSON.parse(rawAddresses);
        if (!Array.isArray(parsed))
            return undefined;

        entries = parsed;
    } catch {
        return undefined;
    }

    if (senderAddress) {
        const normalizedSender = senderAddress.trim().toLowerCase();
        const hasDistinctAddress = entries.some(
            entry => entry?.address?.trim().toLowerCase() !== normalizedSender);

        if (!hasDistinctAddress)
            return undefined;
    }

    const formatted = entries
        .map(entry => {
            const name = entry?.name?.trim();
            const address = entry?.address?.trim();
            if (name && address && name !== address)
                return `${name} <${address}>`;

            return address || name || '';
        })
        .filter(Boolean);

    return formatted.length > 0 ? formatted.join(', ') : undefined;
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
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn(
    { inboxThread: 'thread' }, { emailAccount: 'id' }, 'E-mail');
