// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { LogBuilder } from '@lib/log/index';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { executeServerAction } from '@lib/serverAction';
import db, { tEmailAccounts, tEmailAccountsPermissions, tUsers } from '@lib/database';

import { kInboxOperations } from '../InboxAccess';

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
        executeAccessCheck(props.authenticationContext, 'system.inbox.management');

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

        return { success: true, refresh: true };
    });
}
