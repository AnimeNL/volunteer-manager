// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden, notFound } from 'next/navigation';

import type { UserAuthenticationContext } from '@lib/auth/AuthenticationContext';
import { Cache } from '@lib/cache';
import { queryUsersWithPermission } from '@lib/auth/access/AccessQuery';
import db, { tEmailAccounts, tEmailAccountsPermissions, tUsers } from '@lib/database';

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
     * UTC timestamp of the latest IMAP synchronisation, when available.
     */
    lastSynced?: string;

    /**
     * Operations explicitly granted to the user on this inbox.
     */
    permissions: Record<InboxOperation, boolean>;
}

/**
 * Verifies that `accountIdParam` identifies an active inbound e-mail account (`notFound()` when
 * missing) and that `context` is permitted to perform `operation` on it (`forbidden()` otherwise).
 */
export async function requireInboxAccess(
    context: UserAuthenticationContext,
    accountIdParam: number | string,
    operation: InboxOperation): Promise<AccessibleInbox>
{
    if (!context.access.can('system.inbox.eligible'))
        forbidden();

    const accountId = typeof accountIdParam === 'number'
        ? accountIdParam
        : parseInt(accountIdParam, /* radix= */ 10);

    if (!Number.isSafeInteger(accountId))
        notFound();

    const permissionsJoin = tEmailAccountsPermissions.forUseInLeftJoin();

    const dbInstance = db;
    const row = await dbInstance.selectFrom(tEmailAccounts)
        .leftJoin(permissionsJoin)
            .on(permissionsJoin.emailAccountId.equals(tEmailAccounts.emailAccountId))
                .and(permissionsJoin.userId.equals(context.user.id))
        .where(tEmailAccounts.emailAccountId.equals(accountId))
            .and(tEmailAccounts.emailAccountDeleted.isNull())
            .and(tEmailAccounts.emailAccountImapHostname.isNotNull())
        .select({
            id: tEmailAccounts.emailAccountId,
            address: tEmailAccounts.emailAccountAddress,
            lastSynced: dbInstance.dateTimeAsString(tEmailAccounts.emailAccountImapLastSynced),
            canCreate: permissionsJoin.permissionCreate.equals(/* true= */ 1),
            canRead: permissionsJoin.permissionRead.equals(/* true= */ 1),
            canDelete: permissionsJoin.permissionDelete.equals(/* true= */ 1),
        })
        .executeSelectNoneOrOne();

    if (!row)
        notFound();

    const permissions: Record<InboxOperation, boolean> = {
        create: !!row.canCreate,
        read: !!row.canRead,
        delete: !!row.canDelete,
    };

    if (!permissions[operation])
        forbidden();

    return {
        id: row.id,
        address: row.address,
        lastSynced: row.lastSynced,
        permissions,
    };
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

/**
 * Queries all non-anonymized users who hold `system.inbox.eligible` and have explicit `read`
 * access to the inbound e-mail account identified by `emailAccountId`, ordered by name.
 */
export async function queryInboxAssignees(
    emailAccountId: number): Promise<{ id: number; name: string }[]>
{
    const eligibleUsers = await queryUsersWithPermission('system.inbox.eligible');
    if (!eligibleUsers.length)
        return [];

    const eligibleUserIds = eligibleUsers.map(user => user.id);

    return db.selectFrom(tEmailAccountsPermissions)
        .innerJoin(tEmailAccounts)
            .on(tEmailAccounts.emailAccountId.equals(tEmailAccountsPermissions.emailAccountId))
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tEmailAccountsPermissions.userId))
        .where(tEmailAccountsPermissions.emailAccountId.equals(emailAccountId))
            .and(tEmailAccountsPermissions.permissionRead.equals(/* true= */ 1))
            .and(tEmailAccountsPermissions.userId.in(eligibleUserIds))
            .and(tEmailAccounts.emailAccountDeleted.isNull())
            .and(tEmailAccounts.emailAccountImapHostname.isNotNull())
            .and(tUsers.anonymized.isNull())
        .select({
            id: tUsers.userId,
            name: tUsers.name,
        })
        .orderBy(tUsers.name, 'asc')
        .executeSelectMany();
}

/**
 * Invalidates cached `inbox/*` entries in `AdminNavigationMenuCache`, either for a single `userId`
 * or across all users when omitted.
 */
export function invalidateInboxNavigationCache(userId?: number): void {
    const cache = Cache.getInstance('AdminNavigationMenuCache');
    if (userId !== undefined) {
        cache.delete(`inbox/${userId}`);
        return;
    }

    for (const key of [ ...cache.params() ]) {
        if (key.startsWith('inbox/'))
            cache.delete(key);
    }
}
