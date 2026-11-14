// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { ImportEmailTask, normalizeThreadSubject } from '@lib/scheduler/tasks/ImportEmailTask';
import { createSmtpClient } from '@lib/integrations/smtp';
import { executeServerAction } from '@lib/serverAction';
import { invalidateInboxNavigationCache, requireInboxAccess } from './InboxAccess';
import { readSetting } from '@lib/Settings';
import { requireAuthentication } from '@lib/requireAuthentication';
import db, { tEmailAccounts, tInboxEmail, tInboxThreads, tUsers } from '@lib/database';

/**
 * Represents a parsed e-mail participant (optional display name plus lowercased address).
 */
interface ParsedEmailAddress {
    name?: string;
    address: string;
}

/**
 * Zod type that describes that no data is expected.
 */
const kNoDataRequired = z.object({ /* no parameters */ });

/**
 * Zod type that describes the payload for composing and sending an outbound inbox message.
 */
const kSendInboxMessageData = z.object({
    recipient: z.string().trim().min(1, 'A recipient e-mail address is required.'),
    cc: z.string().trim().optional(),
    subject: z.string().trim().min(1, 'A subject is required.'),
    message: z.string().trim().min(1, 'A message body is required.'),
});

/**
 * Zod type that describes the payload for updating a thread's resolution state.
 */
const kUpdateThreadStateData = z.object({
    resolved: z.boolean(),
});

/**
 * Formats a `ParsedEmailAddress` for Nodemailer's recipient fields.
 */
function formatSmtpAddress(entry: ParsedEmailAddress): string {
    if (!entry.name)
        return entry.address;

    const escapedName = entry.name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `"${escapedName}" <${entry.address}>`;
}

/**
 * Parses a single e-mail address in either `user@domain` or `Display Name <user@domain>` format,
 * returning `null` when the extracted address is not valid.
 */
function parseEmailAddress(input: string): ParsedEmailAddress | null {
    const trimmed = input.trim();
    if (!trimmed)
        return null;

    let name: string | undefined;
    let candidateAddress = trimmed;

    const bracketMatch = trimmed.match(/^(.*?)<([^<>]+)>\s*$/);
    if (bracketMatch) {
        const rawName = bracketMatch[1].trim().replace(/^"(.*)"$/, '$1').trim();
        name = rawName || undefined;
        candidateAddress = bracketMatch[2].trim();
    }

    const validated = z.email().safeParse(candidateAddress);
    if (!validated.success)
        return null;

    return {
        ...(name ? { name } : {}),
        address: validated.data.toLowerCase(),
    };
}

/**
 * Parses a comma- or semicolon-separated list of e-mail addresses, returning `null` when any entry
 * cannot be parsed as a valid address.
 */
function parseEmailAddressList(input: string): ParsedEmailAddress[] | null {
    const tokens: string[] = [];
    let current = '';
    let inQuotes = false;
    let inBrackets = false;

    for (let index = 0; index < input.length; ++index) {
        const char = input[index];
        if (char === '"' && input[index - 1] !== '\\') {
            inQuotes = !inQuotes;
            current += char;
        } else if (!inQuotes && char === '<') {
            inBrackets = true;
            current += char;
        } else if (!inQuotes && char === '>') {
            inBrackets = false;
            current += char;
        } else if (!inQuotes && !inBrackets && (char === ',' || char === ';')) {
            if (current.trim())
                tokens.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    if (current.trim())
        tokens.push(current.trim());

    const results: ParsedEmailAddress[] = [];
    const seen = new Set<string>();

    for (const token of tokens) {
        const parsed = parseEmailAddress(token);
        if (!parsed)
            return null;

        if (!seen.has(parsed.address)) {
            seen.add(parsed.address);
            results.push(parsed);
        }
    }

    return results;
}

/**
 * Truncates `value` to at most `maxLength` characters when non-empty, returning `undefined`
 * otherwise.
 */
function truncate(value: string | undefined, maxLength: number): string | undefined {
    const trimmed = value?.trim();
    if (!trimmed)
        return undefined;

    return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

/**
 * Server Action that sends a new outbound e-mail message from `accountId` and stores both the
 * resulting thread and message in the local inbox tables.
 */
export async function sendInboxMessage(accountId: number, formData: unknown) {
    return executeServerAction(formData, kSendInboxMessageData, async (data, props) => {
        const context = await requireAuthentication(
            props.authenticationContext, 'system.inbox.eligible');

        const account = await requireInboxAccess(context, accountId, 'create');

        const recipient = parseEmailAddress(data.recipient);
        if (!recipient) {
            return {
                success: false,
                error: 'Please enter a valid recipient e-mail address.',
            };
        }

        let ccEntries: ParsedEmailAddress[] = [];
        if (data.cc) {
            const parsedCc = parseEmailAddressList(data.cc);
            if (!parsedCc) {
                return {
                    success: false,
                    error: 'One or more CC e-mail addresses are invalid.',
                };
            }

            ccEntries = parsedCc;
        }

        const dbInstance = db;
        const smtpSettings = await dbInstance.selectFrom(tEmailAccounts)
            .where(tEmailAccounts.emailAccountId.equals(account.id))
                .and(tEmailAccounts.emailAccountDeleted.isNull())
            .select({
                hostname: tEmailAccounts.emailAccountSmtpHostname,
                password: tEmailAccounts.emailAccountSmtpPassword,
            })
            .executeSelectNoneOrOne();

        if (!smtpSettings?.hostname || !smtpSettings.password) {
            return {
                success: false,
                error: 'Outgoing e-mail is not configured for this account.',
            };
        }

        const recipientUser = await dbInstance.selectFrom(tUsers)
            .where(tUsers.username.equals(recipient.address))
                .and(tUsers.anonymized.isNull())
            .select({
                id: tUsers.userId,
                name: tUsers.name,
            })
            .executeSelectNoneOrOne();

        const volunteerName = recipient.name || recipientUser?.name;
        const senderNameSuffix = await readSetting('communication-name-suffix');
        const senderDisplayName = `${context.user.name}${senderNameSuffix || ''}`;

        const client = await createSmtpClient(account.id);
        const smtpMessage = await client.createMessage()
            .setTo(formatSmtpAddress({ name: volunteerName, address: recipient.address }))
            .setSubject(data.subject)
            .asyncSetMarkdown(data.message);

        if (ccEntries.length > 0)
            smtpMessage.setCc(ccEntries.map(formatSmtpAddress));

        let sentInfo: Awaited<ReturnType<typeof client.sendMessage>>;
        try {
            sentInfo = await client.sendMessage({
                sender: senderDisplayName,
                message: smtpMessage,
                sourceUser: context.user.id,
                targetUser: recipientUser?.id,
            });
        } catch (error: unknown) {
            const errorMessage =
                error instanceof Error ? error.message : 'Unable to send the e-mail.';

            return {
                success: false,
                error: `Unable to send the e-mail: ${errorMessage}`,
            };
        }

        const now = Temporal.Now.zonedDateTimeISO('UTC').round('seconds');
        const threadSubject = normalizeThreadSubject(data.subject);
        const messageOptions = smtpMessage.options;

        const toPayload = JSON.stringify([
            {
                ...(volunteerName ? { name: volunteerName } : {}),
                address: recipient.address,
            },
        ]);
        const ccPayload = ccEntries.length > 0 ? JSON.stringify(ccEntries) : null;
        const bodyText =
            typeof messageOptions.text === 'string' ? messageOptions.text : data.message;
        const bodyHtml = typeof messageOptions.html === 'string' ? messageOptions.html : null;

        await dbInstance.transaction(async () => {
            const inboxThreadId = await dbInstance.insertInto(tInboxThreads)
                .set({
                    emailAccountId: account.id,
                    threadSubject,
                    threadFromName: truncate(volunteerName, 255) ?? null,
                    threadFromAddress: truncate(recipient.address, 255) ?? '',
                    threadFromUserId: recipientUser?.id ?? null,
                    threadAssigneeUserId: context.user.id,
                    threadResolved: now,
                    threadLatestDate: now,
                    threadMessageCount: 1,
                })
                .returningLastInsertedId()
                .executeInsert();

            const maxLocalUid = await dbInstance.selectFrom(tInboxEmail)
                .where(tInboxEmail.emailAccountId.equals(account.id))
                    .and(tInboxEmail.inboxUidValidity.equals(0n))
                .selectOneColumn(tInboxEmail.inboxUid)
                .orderBy(tInboxEmail.inboxUid, 'desc')
                .limit(1)
                .executeSelectNoneOrOne();

            await dbInstance.insertInto(tInboxEmail)
                .set({
                    emailAccountId: account.id,
                    inboxThreadId,
                    inboxUidValidity: 0n,
                    inboxUid: (maxLocalUid ?? 0) + 1,
                    inboxMessageId: truncate(sentInfo.messageId, 255) ?? null,
                    inboxDate: now,
                    inboxReceivedDate: now,
                    inboxFromName: truncate(senderDisplayName, 255) ?? null,
                    inboxFromAddress: truncate(account.address.trim().toLowerCase(), 255) ?? '',
                    inboxFromUserId: context.user.id,
                    inboxTo: toPayload,
                    inboxCc: ccPayload,
                    inboxSubject: data.subject,
                    inboxBodyText: bodyText,
                    inboxBodyHtml: bodyHtml,
                    inboxFlags: JSON.stringify([ '\\Seen' ]),
                    inboxRead: now,
                })
                .executeInsert();
        });

        invalidateInboxNavigationCache();

        return {
            success: true,
            refresh: true,
            message: 'The message has been sent.',
        };
    });
}

/**
 * Server Action that manually triggers an IMAP synchronization for the inbound e-mail account
 * identified by `accountId`.
 */
export async function synchronizeInbox(accountId: number, formData: unknown) {
    return executeServerAction(formData, kNoDataRequired, async (_data, props) => {
        const context = await requireAuthentication(
            props.authenticationContext, 'system.inbox.eligible');

        await requireInboxAccess(context, accountId, 'read');

        const synchronized = await ImportEmailTask.synchronizeAccount(accountId);
        if (!synchronized) {
            return {
                success: false,
                error: 'Incoming e-mail is not configured for this account.',
            };
        }

        invalidateInboxNavigationCache();

        return { success: true };
    });
}

/**
 * Server Action that updates whether an inbound e-mail thread is marked as completed (`resolved`)
 * or still needs action. Requires write (`create`) access to the owning inbox.
 */
export async function updateInboxThreadState(
    accountId: number, threadId: number, formData: unknown)
{
    return executeServerAction(formData, kUpdateThreadStateData, async (data, props) => {
        const context = await requireAuthentication(
            props.authenticationContext, 'system.inbox.eligible');

        await requireInboxAccess(context, accountId, 'create');

        if (!Number.isSafeInteger(threadId))
            notFound();

        const dbInstance = db;
        const existingThreadId = await dbInstance.selectFrom(tInboxThreads)
            .where(tInboxThreads.inboxThreadId.equals(threadId))
                .and(tInboxThreads.emailAccountId.equals(accountId))
                .and(tInboxThreads.threadDeleted.isNull())
            .selectOneColumn(tInboxThreads.inboxThreadId)
            .executeSelectNoneOrOne();

        if (!existingThreadId)
            return { success: false, error: 'The thread could not be found.' };

        await dbInstance.update(tInboxThreads)
            .set({
                threadResolved: data.resolved ? dbInstance.currentZonedDateTime() : null,
            })
            .where(tInboxThreads.inboxThreadId.equals(threadId))
                .and(tInboxThreads.emailAccountId.equals(accountId))
                .and(tInboxThreads.threadDeleted.isNull())
            .executeUpdate();

        invalidateInboxNavigationCache();

        return { success: true, refresh: true };
    });
}
