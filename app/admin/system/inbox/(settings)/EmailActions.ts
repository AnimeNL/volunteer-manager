// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { LogBuilder } from '@lib/log/index';
import { SmtpMessage } from '@lib/integrations/smtp/SmtpMessage';
import { clearPageMetadataCache } from '@app/admin/lib/generatePageMetadata';
import { createImapClient } from '@lib/integrations/imap';
import { createSmtpClient } from '@lib/integrations/smtp';
import { executeServerAction } from '@lib/serverAction';
import { invalidateInboxNavigationCache } from '../InboxAccess';
import { readSetting } from '@lib/Settings';
import { requireAuthentication } from '@lib/requireAuthentication';
import db, { tEmailAccounts, tEmailAccountsPermissions, tTeams, tUsers } from '@lib/database';

import { kInboxOperations } from '../InboxAccess';
import { kMaskedPassword } from './MaskedPassword';

/**
 * Zod type that describes that no data is expected.
 */
const kNoDataRequired = z.object({ /* no parameters */ });

/**
 * Zod type that describes information required in order to create a new e-mail account.
 */
const kCreateEmailAccountData = z.object({
    address: z.email(),
});

/**
 * Server Action that creates a new e-mail account and redirects to its configuration page.
 */
export async function createEmailAccount(formData: unknown) {
    return executeServerAction(formData, kCreateEmailAccountData, async (data, props) => {
        await requireAuthentication(props.authenticationContext, 'system.integrations');

        const dbInstance = db;
        const existingAccount = await dbInstance.selectFrom(tEmailAccounts)
            .where(tEmailAccounts.emailAccountAddress.equals(data.address))
                .and(tEmailAccounts.emailAccountDeleted.isNull())
            .selectCountAll()
            .executeSelectNoneOrOne();

        if (!!existingAccount)
            return { success: false, error: 'An account with that e-mail address already exists…' };

        const insertId = await dbInstance.insertInto(tEmailAccounts)
            .set({
                emailAccountAddress: data.address,
                emailAccountSmtpHostname: '',
                emailAccountSmtpPort: 587,
                emailAccountSmtpUsername: '',
                emailAccountSmtpPassword: '',
                emailAccountCreated: dbInstance.currentZonedDateTime(),
                emailAccountUpdated: dbInstance.currentZonedDateTime(),
                emailAccountDeleted: null,
            })
            .returningLastInsertedId()
            .executeInsert();

        if (!insertId)
            return { success: false, error: 'Unable to store the e-mail account in the database…' };

        LogBuilder.for('CreateEmailAddress')
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                address: data.address,
            });

        return {
            success: true,
            redirect: `/admin/system/inbox/accounts/${insertId}`,
        };
    });
}

/**
 * Server Action that soft-deletes the e-mail account identified by `accountId`.
 */
export async function deleteEmailAccount(accountId: number, formData: unknown) {
    return executeServerAction(formData, kNoDataRequired, async (_data, props) => {
        await requireAuthentication(props.authenticationContext, 'system.integrations');

        if (!Number.isSafeInteger(accountId))
            notFound();

        const defaultAccountId = await readSetting('integration-email-default-account-id') ?? 1;
        if (accountId === defaultAccountId)
            return { success: false, error: 'The default e-mail account cannot be deleted…' };

        const dbInstance = db;
        const linkedTeamCount = await dbInstance.selectFrom(tTeams)
            .where(tTeams.teamEmailAccountId.equals(accountId))
                .and(tTeams.teamDeleted.isNull())
            .selectCountAll()
            .executeSelectNoneOrOne();

        if (!!linkedTeamCount) {
            return {
                success: false,
                error: 'This e-mail account is still assigned to one or more teams…',
            };
        }

        const existingAddress = await dbInstance.selectFrom(tEmailAccounts)
            .where(tEmailAccounts.emailAccountId.equals(accountId))
                .and(tEmailAccounts.emailAccountDeleted.isNull())
            .selectOneColumn(tEmailAccounts.emailAccountAddress)
            .executeSelectNoneOrOne();

        if (!existingAddress)
            return { success: false, error: 'The given e-mail account could not be found…' };

        const affectedRows = await dbInstance.update(tEmailAccounts)
            .set({
                emailAccountDeleted: dbInstance.currentZonedDateTime(),
            })
            .where(tEmailAccounts.emailAccountId.equals(accountId))
                .and(tEmailAccounts.emailAccountDeleted.isNull())
            .executeUpdate();

        if (!affectedRows)
            return { success: false, error: 'Unable to delete the e-mail account…' };

        LogBuilder.for('DeleteEmailAddress')
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                address: existingAddress,
            });

        clearPageMetadataCache('emailAccount', accountId);
        invalidateInboxNavigationCache();

        return {
            success: true,
            redirect: '/admin/system/inbox/accounts',
        };
    });
}

/**
 * Zod type that describes the outgoing (SMTP) server configuration of an e-mail account.
 */
const kUpdateEmailAccountSmtpData = z.object({
    smtpHostname: z.string().trim().nonempty(),
    smtpPort: z.coerce.number().int().min(1).max(65535),
    smtpUsername: z.string().trim().nonempty(),
    smtpPassword: z.string().nonempty(),
});

/**
 * Server Action that updates the outgoing (SMTP) server configuration of the e-mail account
 * identified by `accountId`.
 */
export async function updateEmailAccountSmtp(accountId: number, formData: unknown) {
    return executeServerAction(formData, kUpdateEmailAccountSmtpData, async (data, props) => {
        await requireAuthentication(props.authenticationContext, 'system.integrations');

        if (!Number.isSafeInteger(accountId))
            notFound();

        const dbInstance = db;
        const existingAccount = await dbInstance.selectFrom(tEmailAccounts)
            .where(tEmailAccounts.emailAccountId.equals(accountId))
                .and(tEmailAccounts.emailAccountDeleted.isNull())
            .select({
                address: tEmailAccounts.emailAccountAddress,
                hasSmtpPassword: tEmailAccounts.emailAccountSmtpPassword.notEquals(''),
            })
            .executeSelectNoneOrOne();

        if (!existingAccount)
            notFound();

        const passwordChanged = data.smtpPassword !== kMaskedPassword;
        if (!passwordChanged && !existingAccount.hasSmtpPassword)
            return { success: false, error: 'An outgoing (SMTP) password must be provided…' };

        const affectedRows = await dbInstance.update(tEmailAccounts)
            .set({
                emailAccountSmtpHostname: data.smtpHostname,
                emailAccountSmtpPort: data.smtpPort,
                emailAccountSmtpUsername: data.smtpUsername,
                emailAccountUpdated: dbInstance.currentZonedDateTime(),
            })
            .setIfValue({
                emailAccountSmtpPassword: passwordChanged ? data.smtpPassword : undefined,
            })
            .where(tEmailAccounts.emailAccountId.equals(accountId))
                .and(tEmailAccounts.emailAccountDeleted.isNull())
            .executeUpdate();

        LogBuilder.for('UpdateEmailAddress')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                address: existingAccount.address,
            });

        return { success: true, refresh: true };
    });
}

/**
 * Zod type that describes the incoming (IMAP) server configuration of an e-mail account.
 */
const kUpdateEmailAccountImapData = z.object({
    imapHostname: z.string().trim().optional(),
    imapPort: z.union([
        z.literal(''),
        z.coerce.number().int().min(1).max(65535),
    ]).nullish(),
    imapUsername: z.string().trim().optional(),
    imapPassword: z.string().optional(),
});

/**
 * Server Action that updates the incoming (IMAP) server configuration of the e-mail account
 * identified by `accountId`.
 */
export async function updateEmailAccountImap(accountId: number, formData: unknown) {
    return executeServerAction(formData, kUpdateEmailAccountImapData, async (data, props) => {
        await requireAuthentication(props.authenticationContext, 'system.integrations');

        if (!Number.isSafeInteger(accountId))
            notFound();

        const dbInstance = db;
        const existingAccount = await dbInstance.selectFrom(tEmailAccounts)
            .where(tEmailAccounts.emailAccountId.equals(accountId))
                .and(tEmailAccounts.emailAccountDeleted.isNull())
            .select({
                address: tEmailAccounts.emailAccountAddress,
                imapHostname: tEmailAccounts.emailAccountImapHostname,
                imapUsername: tEmailAccounts.emailAccountImapUsername,
                hasImapPassword: tEmailAccounts.emailAccountImapPassword.isNotNull(),
            })
            .executeSelectNoneOrOne();

        if (!existingAccount)
            notFound();

        const hostname = data.imapHostname || null;
        const port = typeof data.imapPort === 'number' ? data.imapPort : null;
        const username = data.imapUsername || null;
        const passwordChanged = !!data.imapPassword && data.imapPassword !== kMaskedPassword;

        const disablingImap = !hostname && port === null && !username && !passwordChanged;
        if (!disablingImap) {
            const hasPassword =
                passwordChanged ||
                (data.imapPassword === kMaskedPassword && existingAccount.hasImapPassword);

            if (!hostname || port === null || !username || !hasPassword) {
                return {
                    success: false,
                    error:
                        'All incoming (IMAP) server fields must be provided, or left blank to ' +
                        'disable incoming e-mail…',
                };
            }
        }

        const resetSyncState =
            disablingImap ||
            hostname !== existingAccount.imapHostname ||
            username !== existingAccount.imapUsername;

        const affectedRows = await dbInstance.update(tEmailAccounts)
            .set({
                emailAccountImapHostname: disablingImap ? null : hostname,
                emailAccountImapPort: disablingImap ? null : port,
                emailAccountImapUsername: disablingImap ? null : username,
                emailAccountUpdated: dbInstance.currentZonedDateTime(),
                ...(disablingImap || passwordChanged
                    ? { emailAccountImapPassword: disablingImap ? null : data.imapPassword }
                    : {}),
                ...(resetSyncState ? {
                    emailAccountImapUidValidity: null,
                    emailAccountImapLastUid: null,
                    emailAccountImapLastSynced: null,
                } : {}),
            })
            .where(tEmailAccounts.emailAccountId.equals(accountId))
                .and(tEmailAccounts.emailAccountDeleted.isNull())
            .executeUpdate();

        LogBuilder.for('UpdateEmailAddress')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                address: existingAccount.address,
            });

        invalidateInboxNavigationCache();

        return { success: true, refresh: true };
    });
}

/**
 * Server Action that verifies the incoming (IMAP) server configuration of the e-mail account
 * identified by `accountId`.
 */
export async function checkEmailAccountImap(accountId: number, formData: unknown) {
    return executeServerAction(formData, kNoDataRequired, async (_data, props) => {
        await requireAuthentication(props.authenticationContext, 'system.integrations');

        if (!Number.isSafeInteger(accountId))
            notFound();

        const client = await createImapClient(accountId);
        await client.verifyConfiguration();

        return { success: true };
    });
}

/**
 * Server Action that verifies the outgoing (SMTP) server configuration of the e-mail account
 * identified by `accountId`.
 */
export async function checkEmailAccountSmtp(accountId: number, formData: unknown) {
    return executeServerAction(formData, kNoDataRequired, async (_data, props) => {
        await requireAuthentication(props.authenticationContext, 'system.integrations');

        if (!Number.isSafeInteger(accountId))
            notFound();

        const client = await createSmtpClient(accountId);
        await client.verifyConfiguration();

        return { success: true };
    });
}

/**
 * Server Action that sends a test message from the e-mail account identified by `accountId` to the
 * signed-in user's e-mail address.
 */
export async function sendEmailAccountTestMessage(accountId: number, formData: unknown) {
    return executeServerAction(formData, kNoDataRequired, async (_data, props) => {
        await requireAuthentication(props.authenticationContext, 'system.integrations');

        if (!Number.isSafeInteger(accountId))
            notFound();

        if (!props.user.username)
            return { success: false, error: 'Your e-mail address is not known.' };

        const message = new SmtpMessage()
            .setTo(props.user.username)
            .setSubject('Test message from the AnimeCon Volunteer Manager')
            .setText(`This is a test message initiated by ${props.user.name}.`);

        const client = await createSmtpClient(accountId);
        await client.sendMessage({
            sender: 'AnimeCon Volunteer Manager',
            sourceUser: props.user.id,
            targetUser: props.user.id,
            message,
        });

        return { success: true };
    });
}

/**
 * Validation scheme for inbox permission updates, mapping `inbox-${id}` keys to selected
 * operations.
 */
const kUpdateInboxPermissionsData = z.record(
    z.string(), z.array(z.enum(kInboxOperations)).nullish());

/**
 * Server Action that replaces the explicit inbox permissions for a given `userId`.
 */
export async function updateInboxPermissions(userId: number, formData: unknown) {
    return executeServerAction(formData, kUpdateInboxPermissionsData, async (data, props) => {
        await requireAuthentication(props.authenticationContext, 'system.inbox.management');

        if (!Number.isSafeInteger(userId))
            notFound();

        const dbInstance = db;
        const targetUserId = await dbInstance.selectFrom(tUsers)
            .where(tUsers.userId.equals(userId))
                .and(tUsers.anonymized.isNull())
            .selectOneColumn(tUsers.userId)
            .executeSelectNoneOrOne();

        if (!targetUserId)
            notFound();

        const inboxIds = await dbInstance.selectFrom(tEmailAccounts)
            .where(tEmailAccounts.emailAccountDeleted.isNull())
                .and(tEmailAccounts.emailAccountImapHostname.isNotNull())
            .selectOneColumn(tEmailAccounts.emailAccountId)
            .executeSelectMany();

        await dbInstance.transaction(async () => {
            await dbInstance.deleteFrom(tEmailAccountsPermissions)
                .where(tEmailAccountsPermissions.userId.equals(userId))
                .executeDelete();

            for (const inboxId of inboxIds) {
                const selected = data[`inbox-${inboxId}`];
                if (!selected?.length)
                    continue;

                await dbInstance.insertInto(tEmailAccountsPermissions)
                    .set({
                        emailAccountId: inboxId,
                        userId,
                        permissionCreate: selected.includes('create') ? 1 : 0,
                        permissionRead: selected.includes('read') ? 1 : 0,
                        permissionDelete: selected.includes('delete') ? 1 : 0,
                    })
                    .executeInsert();
            }
        });

        LogBuilder.for('UpdateAccountInboxPermissions')
            .withInitiatorUser(props.user)
            .withAffectedUser(userId)
            .withSeverity('Warning')
            .record();

        invalidateInboxNavigationCache(userId);

        return { success: true, refresh: true };
    });
}
