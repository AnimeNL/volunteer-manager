// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden, notFound } from 'next/navigation';

import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import Chip from '@mui/material/Chip';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import MailOutlinedIcon from '@mui/icons-material/MailOutlined';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { EmailMessageBody } from './EmailMessageBody';
import { InlineAccountLink } from '@app/admin/components/InlineAccountLink';
import { KeyValueList } from '@app/admin/components/KeyValueList';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { ThreadStateActionBar } from './ThreadStateActionBar';
import { canAccessInbox } from '../../InboxAccess';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthentication } from '@lib/requireAuthentication';
import db, { tEmailAccounts, tInboxEmail, tInboxEmailAttachments, tInboxThreads, tUsers } from '@lib/database';

import { updateInboxThreadState } from '../../InboxActions';

/**
 * Parses a JSON-encoded list of e-mail addresses (`Array<{ name?: string; address: string }>`).
 */
function parseAddressList(rawAddresses?: string | null): { name?: string; address?: string }[] {
    if (!rawAddresses)
        return [];

    try {
        const parsed = JSON.parse(rawAddresses);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

/**
 * Formats a parsed list of e-mail addresses into a human-readable comma-separated string.
 */
function formatAddressList(entries: { name?: string; address?: string }[]): string | undefined {
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
 * Formats a byte size into a compact human-readable binary unit (`B`, `KiB`, or `MiB`).
 */
function formatFileSize(bytes: number): string {
    if (bytes < 1024)
        return `${bytes} B`;

    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KiB`;

    return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

/**
 * Page displaying an individual inbound e-mail thread.
 */
export default async function EmailInboxThreadPage(
    props: PageProps<'/admin/system/inbox/[id]/[thread]'>)
{
    const context = await requireAuthentication('system.inbox.eligible');

    const params = await props.params;

    const accountId = parseInt(params.id, /* radix= */ 10);
    const threadId = parseInt(params.thread, /* radix= */ 10);
    if (!Number.isSafeInteger(accountId) || !Number.isSafeInteger(threadId))
        notFound();

    const dbInstance = db;
    const account = await dbInstance.selectFrom(tEmailAccounts)
        .where(tEmailAccounts.emailAccountId.equals(accountId))
            .and(tEmailAccounts.emailAccountDeleted.isNull())
            .and(tEmailAccounts.emailAccountImapHostname.isNotNull())
            .and(tEmailAccounts.emailAccountImapHostname.notEquals(''))
        .select({
            id: tEmailAccounts.emailAccountId,
            address: tEmailAccounts.emailAccountAddress,
        })
        .executeSelectNoneOrOne();

    if (!account)
        notFound();

    const [ canRead, canUpdate ] = await Promise.all([
        canAccessInbox(context, account.id, 'read'),
        canAccessInbox(context, account.id, 'create'),
    ]);

    if (!canRead)
        forbidden();

    const senderUserJoin = tUsers.forUseInLeftJoinAs('tsu');
    const messageSenderJoin = tUsers.forUseInLeftJoinAs('msu');

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
            resolved: tInboxThreads.threadResolved.isNotNull(),
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

    const attachmentsByEmailId = new Map<number, {
        id: number;
        filename: string;
        hasData: boolean;
        size: number;
    }[]>();

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
                hasData: attachment.hasData,
                size: attachment.size,
            });

            attachmentsByEmailId.set(attachment.emailId, list);
        }
    }

    const subject = thread.subject || '(no subject)';
    const sender = {
        id: thread.sender.id ?? undefined,
        name: thread.sender.name,
    };

    const toggleAction = canUpdate
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
                    Conversation with <InlineAccountLink user={sender} /> in the{' '}
                    <strong>{account.address}</strong> inbox.
                </SectionIntroduction>
                <ThreadStateActionBar action={toggleAction} resolved={thread.resolved}
                                      resolvedDate={thread.resolvedDate ?? undefined} />
            </Section>
            { messages.length === 0 &&
                <Section noHeader>
                    <Typography color="text.secondary" variant="body2">
                        There are no messages in this thread.
                    </Typography>
                </Section> }
            { messages.map(message => {
                const messageSender = {
                    id: message.sender.id ?? undefined,
                    name: message.sender.name,
                };

                const hasDistinctAddress =
                    !!message.fromAddress && message.fromAddress !== messageSender.name;
                const normalizedFromAddress = message.fromAddress.trim().toLowerCase();
                const toFormatted = formatAddressList(parseAddressList(message.to));
                const ccFormatted = formatAddressList(parseAddressList(message.cc));
                const replyToEntries = parseAddressList(message.replyTo);
                const replyToFormatted = formatAddressList(replyToEntries);
                const showReplyTo = !!replyToFormatted && replyToEntries.some(
                    entry => entry?.address?.trim().toLowerCase() !== normalizedFromAddress);
                const messageAttachments = attachmentsByEmailId.get(message.id) ?? [];

                return (
                    <Section key={message.id}
                             icon={ <MailOutlinedIcon color="primary" /> }
                             subtitle={ hasDistinctAddress ? message.fromAddress : undefined }
                             title={messageSender.name}>
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
                                        <InlineAccountLink user={messageSender} />
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
                                condition: showReplyTo,
                                key: 'Reply-To',
                                value: replyToFormatted,
                            },
                        ]} />
                        <EmailMessageBody
                            html={message.html} text={message.text}
                            title={`Message #${message.id} from ${messageSender.name}`} />
                        { messageAttachments.length > 0 &&
                            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }} useFlexGap>
                                { messageAttachments.map(attachment => {
                                    const sizeLabel = formatFileSize(attachment.size);
                                    const label = `${attachment.filename} (${sizeLabel})`;

                                    if (!attachment.hasData) {
                                        return (
                                            <Chip disabled icon={ <AttachFileOutlinedIcon /> }
                                                  key={attachment.id}
                                                  label={`${label} — unavailable`} size="small"
                                                  variant="outlined" />
                                        );
                                    }

                                    const downloadUrl =
                                        `/admin/system/inbox/${account.id}/${thread.id}` +
                                        `/attachments/${attachment.id}`;

                                    return (
                                        <Chip clickable component="a" href={downloadUrl}
                                              icon={ <AttachFileOutlinedIcon /> }
                                              key={attachment.id} label={label} size="small"
                                              variant="outlined" />
                                    );
                                }) }
                            </Stack> }
                    </Section>
                );
            }) }
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn(
    { param: 'thread', prefix: '#' }, { emailAccount: 'id' }, 'E-mail');
