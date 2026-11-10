// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { ImapMessage } from '@lib/integrations/imap';
import { Task } from '../Task';
import { TaskContext } from '../TaskContext';
import { createImapClient } from '@lib/integrations/imap';
import db, { tEmailAccounts, tInboxEmail, tInboxEmailAttachments } from '@lib/database';

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
 * Task that downloads new inbound e-mail messages from configured IMAP accounts and stores them,
 * together with any attachments, in our local database.
 */
export class ImportEmailTask extends Task {
    /**
     * Maximum number of messages downloaded per account in a single `readMessages()` session.
     */
    static readonly kBatchSize = 100;

    /**
     * Maximum attachment size stored inline in `inbox_email_attachments` (10 MiB), safely below
     * MariaDB's `MEDIUMBLOB` and default `max_allowed_packet` limits. Oversized attachments still
     * record their metadata row with `attachment_data = NULL`.
     */
    static readonly kMaxAttachmentSizeBytes = 10 * 1024 * 1024;

    /**
     * Executes a one-off IMAP synchronization for the e-mail account identified by `accountId`.
     */
    static async synchronizeAccount(accountId: number): Promise<boolean> {
        const account = await db.selectFrom(tEmailAccounts)
            .where(tEmailAccounts.emailAccountId.equals(accountId))
                .and(tEmailAccounts.emailAccountDeleted.isNull())
                .and(tEmailAccounts.emailAccountImapHostname.isNotNull())
                .and(tEmailAccounts.emailAccountImapPort.isNotNull())
                .and(tEmailAccounts.emailAccountImapUsername.isNotNull())
                .and(tEmailAccounts.emailAccountImapPassword.isNotNull())
            .select({
                id: tEmailAccounts.emailAccountId,
                address: tEmailAccounts.emailAccountAddress,
                uidValidity: tEmailAccounts.emailAccountImapUidValidity,
                lastUid: tEmailAccounts.emailAccountImapLastUid,
            })
            .executeSelectNoneOrOne();

        if (!account)
            return false;

        const taskContext = TaskContext.forEphemeralTask('ImportEmailTask', null);

        const task = new ImportEmailTask(taskContext);
        await task.synchronizeAccount(account);

        return true;
    }

    override async execute(): Promise<boolean> {
        const accounts = await db.selectFrom(tEmailAccounts)
            .where(tEmailAccounts.emailAccountDeleted.isNull())
                .and(tEmailAccounts.emailAccountImapHostname.isNotNull())
                .and(tEmailAccounts.emailAccountImapPort.isNotNull())
                .and(tEmailAccounts.emailAccountImapUsername.isNotNull())
                .and(tEmailAccounts.emailAccountImapPassword.isNotNull())
            .select({
                id: tEmailAccounts.emailAccountId,
                address: tEmailAccounts.emailAccountAddress,
                uidValidity: tEmailAccounts.emailAccountImapUidValidity,
                lastUid: tEmailAccounts.emailAccountImapLastUid,
            })
            .orderBy(tEmailAccounts.emailAccountId, 'asc')
            .executeSelectMany();

        if (!accounts.length) {
            this.log.info('No e-mail accounts with IMAP configuration found; skipping.');
            return true;
        }

        let allAccountsSucceeded = true;
        for (const account of accounts) {
            try {
                await this.synchronizeAccount(account);
            } catch (error: unknown) {
                allAccountsSucceeded = false;

                const message = error instanceof Error ? error.message : String(error);
                this.log.exception(
                    `[${account.address}] Failed to synchronize IMAP messages: ${message}`, error);
            }
        }

        return allAccountsSucceeded;
    }

    // ---------------------------------------------------------------------------------------------

    /**
     * Synchronizes up to `kBatchSize` new (or historical) messages in `"INBOX"` for `account`.
     */
    private async synchronizeAccount(account: {
        id: number;
        address: string;
        uidValidity?: bigint;
        lastUid?: number;
    }): Promise<void> {
        const client = await createImapClient(account.id);
        const result = await client.readMessages({
            mailbox: 'INBOX',
            uidValidity: account.uidValidity,
            sinceUid: account.lastUid,
            limit: ImportEmailTask.kBatchSize,
            markAsSeen: false,
        });

        if (result.uidValidityReset) {
            this.log.warning(
                `[${account.address}] Mailbox UIDVALIDITY changed from ` +
                `${account.uidValidity} to ${result.uidValidity}; resynchronising from UID 1.`);
        }

        if (!result.messages.length) {
            const uidValidity = result.uidValidity ?? account.uidValidity ?? null;
            const lastUid = result.uidValidityReset ? null : (account.lastUid ?? null);

            const dbInstance = db;
            await dbInstance.update(tEmailAccounts)
                .set({
                    emailAccountImapUidValidity: uidValidity,
                    emailAccountImapLastUid: lastUid,
                    emailAccountImapLastSynced: dbInstance.currentZonedDateTime(),
                })
                .where(tEmailAccounts.emailAccountId.equals(account.id))
                .executeUpdate();

            this.log.info(`[${account.address}] Synchronized INBOX: no new messages.`);
            return;
        }

        const uidValidityToStore = result.uidValidity ?? account.uidValidity ?? 0n;

        let importedMessages = 0;
        let importedAttachments = 0;

        for (const message of result.messages) {
            const outcome = await this.persistMessage(
                account, uidValidityToStore, result.uidValidityReset, message);

            if (outcome.inserted) {
                importedMessages++;
                importedAttachments += outcome.attachments;
            }
        }

        if (result.hasMore) {
            this.log.info(
                `[${account.address}] Reached batch limit (${ImportEmailTask.kBatchSize} ` +
                'messages); remaining messages will be imported on the next run.');
        }

        this.log.info(
            `[${account.address}] Synchronized INBOX: imported ${importedMessages} message(s) ` +
            `and ${importedAttachments} attachment(s).`);
    }

    /**
     * Persists a single `ImapMessage` (and its attachments) together with the updated account sync
     * cursor in an atomic database transaction.
     */
    private async persistMessage(
        account: { id: number; address: string },
        uidValidity: bigint,
        uidValidityReset: boolean,
        message: ImapMessage): Promise<{ inserted: boolean; attachments: number }>
    {
        const now = Temporal.Now.zonedDateTimeISO('UTC');
        const inboxReceivedDate =
            (message.receivedDate ?? message.date)?.round('seconds').toZonedDateTimeISO('UTC') ??
            now;
        const inboxDate =
            (message.date ?? message.receivedDate)?.round('seconds').toZonedDateTimeISO('UTC') ??
            inboxReceivedDate;

        const primaryFrom = message.from[0];
        const normalizedFromAddress = primaryFrom?.address.trim().toLowerCase() ?? '';

        const inboxMessageId = truncate(message.messageId, 255) ?? null;
        const inboxInReplyTo = truncate(message.inReplyTo, 255) ?? null;
        const inboxFromName = truncate(primaryFrom?.name, 255) ?? null;
        const inboxFromAddress = truncate(normalizedFromAddress, 255) ?? '';

        const dbInstance = db;
        return dbInstance.transaction(async () => {
            if (uidValidityReset && inboxMessageId) {
                const existingEmailId = await dbInstance.selectFrom(tInboxEmail)
                    .where(tInboxEmail.emailAccountId.equals(account.id))
                        .and(tInboxEmail.inboxMessageId.equals(inboxMessageId))
                    .selectOneColumn(tInboxEmail.inboxEmailId)
                    .executeSelectNoneOrOne();

                if (existingEmailId) {
                    await dbInstance.update(tInboxEmail)
                        .set({
                            inboxUidValidity: uidValidity,
                            inboxUid: message.uid,
                        })
                        .where(tInboxEmail.inboxEmailId.equals(existingEmailId))
                        .executeUpdate();

                    await dbInstance.update(tEmailAccounts)
                        .set({
                            emailAccountImapUidValidity: uidValidity,
                            emailAccountImapLastUid: message.uid,
                            emailAccountImapLastSynced: dbInstance.currentZonedDateTime(),
                        })
                        .where(tEmailAccounts.emailAccountId.equals(account.id))
                        .executeUpdate();

                    return { inserted: false, attachments: 0 };
                }
            }

            const inboxEmailId = await dbInstance.insertInto(tInboxEmail)
                .set({
                    emailAccountId: account.id,
                    inboxUidValidity: uidValidity,
                    inboxUid: message.uid,
                    inboxMessageId,
                    inboxInReplyTo,
                    inboxDate,
                    inboxReceivedDate,
                    inboxFromName,
                    inboxFromAddress,
                    inboxTo: JSON.stringify(message.to),
                    inboxCc: message.cc.length ? JSON.stringify(message.cc) : null,
                    inboxReplyTo: message.replyTo.length ? JSON.stringify(message.replyTo) : null,
                    inboxSubject: message.subject ?? '',
                    inboxBodyText: message.text ?? null,
                    inboxBodyHtml: message.html ?? null,
                    inboxFlags: message.flags.length ? JSON.stringify(message.flags) : null,
                    inboxRead: message.flags.includes('\\Seen') ? inboxReceivedDate : null,
                })
                .onConflictDoNothing()
                .returningLastInsertedId()
                .executeInsert();

            if (inboxEmailId) {
                for (const attachment of message.attachments) {
                    const exceedsLimit =
                        attachment.bytes.byteLength > ImportEmailTask.kMaxAttachmentSizeBytes;

                    if (exceedsLimit) {
                        this.log.warning(
                            `[${account.address}] Omitting attachment bytes for UID ` +
                            `${message.uid} ("${attachment.filename ?? 'unnamed'}", ` +
                            `${attachment.bytes.byteLength} bytes > ` +
                            `${ImportEmailTask.kMaxAttachmentSizeBytes} bytes).`);
                    }

                    const attachmentData = exceedsLimit ? undefined : attachment.bytes;

                    await dbInstance.insertInto(tInboxEmailAttachments)
                        .set({
                            inboxEmailId,
                            attachmentFilename: truncate(attachment.filename, 255) ?? null,
                            attachmentMimeType:
                                truncate(
                                    attachment.mimeType || 'application/octet-stream', 128)!,
                            attachmentSize: attachment.bytes.byteLength,
                        })
                        .setIfValue({
                            attachmentData,
                        })
                        .executeInsert();
                }
            }

            await dbInstance.update(tEmailAccounts)
                .set({
                    emailAccountImapUidValidity: uidValidity,
                    emailAccountImapLastUid: message.uid,
                    emailAccountImapLastSynced: dbInstance.currentZonedDateTime(),
                })
                .where(tEmailAccounts.emailAccountId.equals(account.id))
                .executeUpdate();

            return {
                inserted: Boolean(inboxEmailId),
                attachments: inboxEmailId ? message.attachments.length : 0,
            };
        });
    }
}
