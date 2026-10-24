// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';

import type { AccessDescriptor } from '@lib/auth/AccessDescriptor';
import type { AccessResult } from '@lib/auth/AccessControl';
import type { BooleanPermission, CRUDPermission } from '@lib/auth/Access';
import type { PermissionSelectorStatus } from './PermissionSelectorTable';
import type { ServerAction } from '@lib/serverAction';
import { AccessControl } from '@lib/auth/AccessControl';
import { FormGrid } from '@app/admin/components/FormGrid';
import { PermissionSelectorTable } from './PermissionSelectorTable';
import { isRestricted, parseCrudOperations } from './toPermissionList';
import db, { tPermissions } from '@lib/database';

import { kAnyEvent, kAnyTeam } from '@lib/auth/AccessControl';
import { kPermissions } from '@lib/auth/Access';
import { kSelfSuffix } from './toPermissionList';

/**
 * Default scope used to query whether a permission is granted for any event and team.
 */
const kAnyScope = {
    event: kAnyEvent,
    team: kAnyTeam,
};

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
    const roleAccessControl = props.roleAccessControl ?? new AccessControl({ /* no grants */ });

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

        const descriptor: AccessDescriptor =
            kPermissions[permissionRecord.id as keyof typeof kPermissions];

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

        if (typeof descriptor.restrict === 'string')
            permission.restricted = isRestricted(descriptor.restrict, props.access);

        if (descriptor.type === 'crud') {
            const crudPermission = permissionRecord.id as CRUDPermission;
            const operations = parseCrudOperations(permissionRecord.operations);

            permission.suffix = kSelfSuffix;  // avoids overwriting values when submitting the form

            for (const operation of operations) {
                const childPermission: PermissionSelectorStatus = {
                    id: `${permissionRecord.id}.${operation}`,
                    name: `${uppercaseFirst(operation)} ${lowercaseFirst(permissionRecord.name)}`,
                    restricted: !!permission.restricted,
                    status: {
                        account: targetAccessControl.query(crudPermission, operation, kAnyScope),
                        roles: roleAccessControl.query(crudPermission, operation, kAnyScope),
                    },
                };

                if (typeof descriptor.restrict === 'object' && operation in descriptor.restrict) {
                    if (!!descriptor.restrict[operation]) {
                        childPermission.restricted =
                            isRestricted(descriptor.restrict[operation], props.access);
                    }
                }

                permission.status.account = maybeUpgradePermissionStatus(
                    permission.status.account, childPermission.status.account);

                permission.status.roles = maybeUpgradePermissionStatus(
                    permission.status.roles, childPermission.status.roles);

                const accountStatus = childPermission.status.account;
                if (typeof accountStatus === 'object' &&
                        (accountStatus.expanded === false || accountStatus.crud === false))
                {
                    const prefix = accountStatus.result === 'granted' ? 'grants' : 'revokes';
                    const key = accountStatus.crud
                        ? `${permissionRecord.id}.${operation}`
                        : `${permissionRecord.id}${kSelfSuffix}`;

                    defaultValues[`${prefix}[${key}]`] = true;
                }

                permissionChildren.push(childPermission);
            }
        } else {
            const booleanPermission = permissionRecord.id as BooleanPermission;

            permission.status.account = targetAccessControl.query(booleanPermission, kAnyScope);
            permission.status.roles = roleAccessControl.query(booleanPermission, kAnyScope);

            if (permission.status.account?.expanded === false) {
                const prefix =
                    permission.status.account.result === 'granted' ? 'grants' : 'revokes';

                defaultValues[`${prefix}[${permissionRecord.id}]`] = true;
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
