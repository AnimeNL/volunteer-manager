// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { UserAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tEmailAccounts, tEmailAccountsPermissions } from '@lib/database';

/**
 * Operations that can be explicitly granted on an inbound e-mail inbox.
 */
export const kInboxOperations = [ 'create', 'read', 'delete' ] as const;

/**
 * Type representing a single operation supported on an inbound e-mail inbox.
 */
export type InboxOperation = (typeof kInboxOperations)[number];

/**
 * Mapping from an `InboxOperation` to the corresponding database column on
 * `tEmailAccountsPermissions`.
 */
const kOperationColumns = {
    create: tEmailAccountsPermissions.permissionCreate,
    read: tEmailAccountsPermissions.permissionRead,
    delete: tEmailAccountsPermissions.permissionDelete,
} as const;

/**
 * Describes an inbound e-mail inbox that an authenticated user has explicit access to.
 */
export interface AccessibleInbox {
    /**
     * Unique ID of the e-mail account (`email_accounts.email_account_id`).
     */
    id: number;

    /**
     * E-mail address associated with the inbox.
     */
    address: string;

    /**
     * Operations explicitly granted to the user on this inbox.
     */
    permissions: {
        create: boolean;
        read: boolean;
        delete: boolean;
    };
}

/**
 * Returns whether the user represented by `context` is allowed to perform `operation` on the
 * inbound e-mail account identified by `emailAccountId`.
 */
export async function canAccessInbox(
    context: UserAuthenticationContext,
    emailAccountId: number,
    operation: InboxOperation): Promise<boolean>
{
    if (!context.access.can('system.inbox.eligible'))
        return false;

    const match = await db.selectFrom(tEmailAccountsPermissions)
        .innerJoin(tEmailAccounts)
            .on(tEmailAccounts.emailAccountId.equals(tEmailAccountsPermissions.emailAccountId))
        .where(tEmailAccountsPermissions.userId.equals(context.user.id))
            .and(tEmailAccountsPermissions.emailAccountId.equals(emailAccountId))
            .and(tEmailAccounts.emailAccountDeleted.isNull())
            .and(tEmailAccounts.emailAccountImapHostname.isNotNull())
            .and(kOperationColumns[operation].equals(/* true= */ 1))
        .selectOneColumn(tEmailAccounts.emailAccountId)
        .executeSelectNoneOrOne();

    return !!match;
}

/**
 * Queries all active inbound e-mail accounts that the user represented by `context` has been
 * explicitly granted access to, optionally filtered to a specific `operation`.
 */
export async function queryAccessibleInboxes(
    context: UserAuthenticationContext,
    operation?: InboxOperation): Promise<AccessibleInbox[]>
{
    if (!context.access.can('system.inbox.eligible'))
        return [];

    const operationCondition = operation
        ? kOperationColumns[operation].equals(/* true= */ 1)
        : tEmailAccountsPermissions.permissionCreate.equals(/* true= */ 1).or(
          tEmailAccountsPermissions.permissionRead.equals(/* true= */ 1)).or(
          tEmailAccountsPermissions.permissionDelete.equals(/* true= */ 1));

    return db.selectFrom(tEmailAccountsPermissions)
        .innerJoin(tEmailAccounts)
            .on(tEmailAccounts.emailAccountId.equals(tEmailAccountsPermissions.emailAccountId))
        .where(tEmailAccountsPermissions.userId.equals(context.user.id))
            .and(tEmailAccounts.emailAccountDeleted.isNull())
            .and(tEmailAccounts.emailAccountImapHostname.isNotNull())
            .and(operationCondition)
        .select({
            id: tEmailAccounts.emailAccountId,
            address: tEmailAccounts.emailAccountAddress,
            permissions: {
                create: tEmailAccountsPermissions.permissionCreate.equals(/* true= */ 1),
                read: tEmailAccountsPermissions.permissionRead.equals(/* true= */ 1),
                delete: tEmailAccountsPermissions.permissionDelete.equals(/* true= */ 1),
            },
        })
        .orderBy(tEmailAccounts.emailAccountAddress, 'asc')
        .executeSelectMany();
}
