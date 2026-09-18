// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';

import type { AccessControl, AccessResult } from '@lib/auth/AccessControl';
import type { PermissionSelectorStatus } from './PermissionSelectorTable';
import type { ServerAction } from '@lib/serverAction';
import { AccessControl as AccessControlImpl } from '@lib/auth/AccessControl';
import { FormGrid } from '@app/admin/components/FormGrid';
import { isRestricted } from './toPermissionList';
import { PermissionSelectorTable } from './PermissionSelectorTable';
import db, { tPermissions } from '@lib/database';

import { kAnyEvent, kAnyTeam } from '@lib/auth/AccessControl';
import { kPermissions } from '@lib/auth/Access';
import { kSelfSuffix } from './toPermissionList';

/**
 * Supported operations for CRUD permissions, in canonical display order.
 */
const kOperations = [ 'create', 'read', 'update', 'delete' ] as const;

/**
 * Helper function that lowercases the first letter of the given `text`.
 */
function lowercaseFirst(text: string): string {
    return text.charAt(0).toLowerCase() + text.slice(1);
}

/**
 * Helper function that capitalises the first letter of the given `text`.
 */
function uppercaseFirst(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Decides whether the 'current' should be upgraded into the `child` permission status. This is
 * only the case when the `child` status is less specific than the given `current` status.
 */
function maybeUpgradePermissionStatus(
    current: AccessResult | 'partial' | undefined, child: AccessResult | 'partial' | undefined)
        : AccessResult | 'partial' | undefined
{
    if (!current && child && child !== 'partial') {
        if (child.expanded || child.result === 'granted')
            return child;

    } else if (current && current !== 'partial' && child) {
        if (child === 'partial' || child.result === 'revoked')
            return 'partial';
    }

    return current;
}

/**
 * Props accepted by the generic <PermissionSelector> component.
 */
interface PermissionSelectorProps {
    /**
     * Access control object representing the signed in user.
     */
    access: AccessControl;

    /**
     * Server action that will be invoked when the form is submitted.
     */
    action: ServerAction;

    /**
     * Children to be displayed before the permission selector table (such as extra form controls
     * or alerts).
     */
    children?: React.ReactNode;

    /**
     * Default values to populate the form with.
     */
    defaultValues?: Record<string, any>;

    /**
     * Optional footer to render after the permission selector table.
     */
    footer?: React.ReactNode;

    /**
     * Whether the permissions should be displayed as read-only.
     */
    readOnly?: boolean;

    /**
     * Role-based access control object, if any.
     */
    roleAccessControl?: AccessControl;

    /**
     * Target access control object representing the account or role being configured.
     */
    targetAccessControl: AccessControl;
}

/**
 * The <PermissionSelector> component displays the permissions that have been granted to the given
 * target access control object. The settings can be updated in real time.
 */
export async function PermissionSelector(props: PermissionSelectorProps) {
    const defaultValues: Record<string, any> = { ...props.defaultValues };

    const targetAccessControl = props.targetAccessControl;
    const roleAccessControl =
        props.roleAccessControl ?? new AccessControlImpl({ /* no grants */ });

    const defaultOptions = {
        event: kAnyEvent,
        team: kAnyTeam,
    };

    const permissions: PermissionSelectorStatus[] = [ /* empty */ ];

    const dbPermissions = await db.selectFrom(tPermissions)
        .select({
            id: tPermissions.permissionId,
            name: tPermissions.permissionName,
            description: tPermissions.permissionDescription,
            operations: tPermissions.permissionOperations,
            warning: tPermissions.permissionWarning.equals(/* true= */ 1),
        })
        .orderBy(tPermissions.permissionId, 'asc')
        .executeSelectMany();

    for (const permissionRecord of dbPermissions) {
        if (!Object.hasOwn(kPermissions, permissionRecord.id))
            continue;  // stale data in the database for a renamed permission

        const permissionChildren: PermissionSelectorStatus[] = [];
        const permission: PermissionSelectorStatus = {
            id: permissionRecord.id,
            name: permissionRecord.name,
            description: permissionRecord.description,
            status: {
                account: undefined,
                roles: undefined,
            },
            warning: permissionRecord.warning,
        };

        if (permissionRecord.id === 'root')
            permission.restricted = isRestricted('root', props.access);

        const rawOperations = permissionRecord.operations
            ? permissionRecord.operations.split(',').map(op => op.trim()).filter(Boolean)
            : [];

        const operations = kOperations.filter(op => rawOperations.includes(op));

        if (operations.length > 0) {
            permission.suffix = kSelfSuffix;  // avoids overwriting values when submitting the form

            for (const operation of operations) {
                const childPermission: PermissionSelectorStatus = {
                    id: `${permissionRecord.id}.${operation}`,
                    name: `${uppercaseFirst(operation)} ${lowercaseFirst(permissionRecord.name)}`,
                    restricted: !!permission.restricted,
                    status: {
                        account:
                            targetAccessControl.query(
                                permissionRecord.id as any, operation, defaultOptions),
                        roles:
                            roleAccessControl.query(
                                permissionRecord.id as any, operation, defaultOptions),
                    },
                };

                permission.status.account = maybeUpgradePermissionStatus(
                    permission.status.account, childPermission.status.account);

                permission.status.roles = maybeUpgradePermissionStatus(
                    permission.status.roles, childPermission.status.roles);

                if (typeof childPermission.status.account === 'object' &&
                        (childPermission.status.account.expanded === false ||
                         childPermission.status.account.crud === false))
                {
                    if (childPermission.status.account.result === 'granted') {
                        if (childPermission.status.account.crud)
                            defaultValues[`grants[${permissionRecord.id}.${operation}]`] = true;
                        else
                            defaultValues[`grants[${permissionRecord.id}${kSelfSuffix}]`] = true;

                    } else {
                        if (childPermission.status.account.crud)
                            defaultValues[`revokes[${permissionRecord.id}.${operation}]`] = true;
                        else
                            defaultValues[`revokes[${permissionRecord.id}${kSelfSuffix}]`] = true;
                    }
                }

                permissionChildren.push(childPermission);
            }
        } else {
            permission.status.account =
                targetAccessControl.query(permissionRecord.id as any, defaultOptions);
            permission.status.roles =
                roleAccessControl.query(permissionRecord.id as any, defaultOptions);

            if (permission.status.account?.expanded === false) {
                if (permission.status.account.result === 'granted')
                    defaultValues[`grants[${permissionRecord.id}]`] = true;
                else
                    defaultValues[`revokes[${permissionRecord.id}]`] = true;
            }
        }

        permissions.push(permission, ...permissionChildren);
    }

    // ---------------------------------------------------------------------------------------------

    const outranks = targetAccessControl.can('root') && !props.access.can('root');
    const readOnly = props.readOnly || outranks;

    return (
        <FormGrid action={props.action} defaultValues={defaultValues}>
            { outranks &&
                <Grid size={{ xs: 12 }}>
                    <Alert severity="error" variant="outlined">
                        This entity has higher permissions than yours, so you won't be able to
                        change its permission settings.
                    </Alert>
                </Grid> }

            {props.children}

            <Grid size={{ xs: 12 }}>
                <PermissionSelectorTable permissions={permissions} readOnly={readOnly} />
            </Grid>

            {props.footer}

        </FormGrid>
    );
}
