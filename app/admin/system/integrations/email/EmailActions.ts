// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { Cache } from '@lib/cache';
import { LogBuilder } from '@lib/log/index';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { executeServerAction } from '@lib/serverAction';
import { readSetting } from '@lib/Settings';
import db, { tEmailAccounts, tTeams } from '@lib/database';

/**
 * Masked placeholder returned to the client instead of a plaintext password.
 */
export const kMaskedPassword = '●●●●●●●●';

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
    'use server';
    return executeServerAction(formData, kCreateEmailAccountData, async (data, props) => {
        executeAccessCheck(props.authenticationContext, 'system.integrations');

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

        Cache.getInstance('AdminNavigationMenuCache').clear();

        return {
            success: true,
            redirect: `/admin/system/integrations/email/${insertId}`,
        };
    });
}

/**
 * Server Action that soft-deletes the e-mail account identified by `accountId`.
 */
export async function deleteEmailAccount(accountId: number, formData: unknown) {
    'use server';
    return executeServerAction(formData, kNoDataRequired, async (data, props) => {
        executeAccessCheck(props.authenticationContext, 'system.integrations');

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
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                address: existingAddress,
            });

        Cache.getInstance('AdminNavigationMenuCache').clear();

        return {
            success: true,
            redirect: '/admin/system/integrations/email',
        };
    });
}

/**
 * Zod type that describes the configuration fields of an e-mail account.
 */
const kUpdateEmailAccountData = z.object({
    address: z.email(),

    smtpHostname: z.string().trim().nonempty(),
    smtpPort: z.coerce.number().int().min(1).max(65535),
    smtpUsername: z.string().trim().nonempty(),
    smtpPassword: z.string().nonempty(),

    imapHostname: z.string().trim().optional(),
    imapPort: z.union([
        z.literal(''),
        z.coerce.number().int().min(1).max(65535),
    ]).nullish(),
    imapUsername: z.string().trim().optional(),
    imapPassword: z.string().optional(),
});

/**
 * Server Action that updates the configuration of the e-mail account identified by `accountId`.
 */
export async function updateEmailAccount(accountId: number, formData: unknown) {
    'use server';
    return executeServerAction(formData, kUpdateEmailAccountData, async (data, props) => {
        executeAccessCheck(props.authenticationContext, 'system.integrations');

        const dbInstance = db;
        const existingAccount = await dbInstance.selectFrom(tEmailAccounts)
            .where(tEmailAccounts.emailAccountId.equals(accountId))
                .and(tEmailAccounts.emailAccountDeleted.isNull())
            .select({
                address: tEmailAccounts.emailAccountAddress,
                hasSmtpPassword: tEmailAccounts.emailAccountSmtpPassword.notEquals(''),
                hasImapPassword: tEmailAccounts.emailAccountImapPassword.isNotNull(),
            })
            .executeSelectNoneOrOne();

        if (!existingAccount)
            notFound();

        const duplicateAccount = await dbInstance.selectFrom(tEmailAccounts)
            .where(tEmailAccounts.emailAccountAddress.equals(data.address))
                .and(tEmailAccounts.emailAccountId.notEquals(accountId))
                .and(tEmailAccounts.emailAccountDeleted.isNull())
            .selectCountAll()
            .executeSelectNoneOrOne();

        if (!!duplicateAccount) {
            return {
                success: false,
                error: 'Another account with that e-mail address already exists…',
            };
        }

        const smtpPasswordChanged = data.smtpPassword !== kMaskedPassword;
        if (!smtpPasswordChanged && !existingAccount.hasSmtpPassword)
            return { success: false, error: 'An outgoing (SMTP) password must be provided…' };

        const imapHostname = data.imapHostname || '';
        const imapPort = typeof data.imapPort === 'number' ? data.imapPort : null;
        const imapUsername = data.imapUsername || '';
        const imapPasswordRaw = data.imapPassword || '';
        const imapPasswordEntered = !!imapPasswordRaw && imapPasswordRaw !== kMaskedPassword;

        const hasAnyImapField =
            !!imapHostname || imapPort !== null || !!imapUsername || imapPasswordEntered;

        let imapFields: {
            emailAccountImapHostname: string | null;
            emailAccountImapPort: number | null;
            emailAccountImapUsername: string | null;
            emailAccountImapPassword?: string | null;
        };

        if (!hasAnyImapField) {
            imapFields = {
                emailAccountImapHostname: null,
                emailAccountImapPort: null,
                emailAccountImapUsername: null,
                emailAccountImapPassword: null,
            };
        } else {
            const hasValidImapPassword =
                imapPasswordEntered ||
                (imapPasswordRaw === kMaskedPassword && existingAccount.hasImapPassword);

            if (!imapHostname || imapPort === null || !imapUsername || !hasValidImapPassword) {
                return {
                    success: false,
                    error:
                        'All incoming (IMAP) server fields must be provided, or left blank to ' +
                        'disable incoming e-mail…',
                };
            }

            imapFields = {
                emailAccountImapHostname: imapHostname,
                emailAccountImapPort: imapPort,
                emailAccountImapUsername: imapUsername,
                ...(imapPasswordEntered ? { emailAccountImapPassword: imapPasswordRaw } : {}),
            };
        }

        const affectedRows = await dbInstance.update(tEmailAccounts)
            .set({
                emailAccountAddress: data.address,
                emailAccountSmtpHostname: data.smtpHostname,
                emailAccountSmtpPort: data.smtpPort,
                emailAccountSmtpUsername: data.smtpUsername,
                ...(smtpPasswordChanged ? { emailAccountSmtpPassword: data.smtpPassword } : {}),
                ...imapFields,
                emailAccountUpdated: dbInstance.currentZonedDateTime(),
            })
            .where(tEmailAccounts.emailAccountId.equals(accountId))
                .and(tEmailAccounts.emailAccountDeleted.isNull())
            .executeUpdate();

        LogBuilder.for('UpdateEmailAddress')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                address: data.address,
            });

        Cache.getInstance('AdminNavigationMenuCache').clear();

        return { success: true, refresh: true };
    });
}
