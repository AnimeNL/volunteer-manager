// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';

import type { ServerAction } from '@lib/serverAction';
import { AccessControl } from '@lib/auth/AccessControl';
import { PermissionSelector } from './PermissionSelector';
import db, { tPermissionsRoles } from '@lib/database';

/**
 * Props accepted by the <RolePermissionSelector> component.
 */
interface RolePermissionSelectorProps {
    /**
     * Access control object representing the signed in user.
     */
    access: AccessControl;

    /**
     * Server action that will be invoked when the form is submitted.
     */
    action: ServerAction;

    /**
     * Whether the permissions should be displayed as read-only.
     */
    readOnly?: boolean;

    /**
     * Unique ID of the role whose permissions are being configured.
     */
    roleId: string;
}

/**
 * The <RolePermissionSelector> component displays the permissions that have been granted to the
 * given role, as indicated in the `props`. The settings can be updated in real time.
 */
export async function RolePermissionSelector(props: RolePermissionSelectorProps) {
    let roleConfiguration: {
        grants?: string | null;
        revokes?: string | null;
    } | null = null;

    if (props.roleId === 'root') {
        roleConfiguration = {
            grants: 'root',
            revokes: null,
        };
    } else {
        roleConfiguration = await db.selectFrom(tPermissionsRoles)
            .where(tPermissionsRoles.permissionRoleId.equals(props.roleId))
            .select({
                grants: tPermissionsRoles.permissionRoleGrants,
                revokes: tPermissionsRoles.permissionRoleRevokes,
            })
            .executeSelectNoneOrOne();

        if (!roleConfiguration)
            notFound();
    }

    const targetAccessControl = new AccessControl({
        grants: roleConfiguration.grants ?? undefined,
        revokes: roleConfiguration.revokes ?? undefined,
    });

    const isRoot = props.roleId === 'root';

    return (
        <PermissionSelector
            access={props.access}
            action={props.action}
            introduction={
                <>
                    Granting permissions to a role gives all principals assigned to this role that
                    access within the Volunteer Manager. While you can also revoke permissions, it's
                    usually best to keep that to a minimum.
                </>
            }
            outranksMessage="This role has higher permissions than yours, so you won't be able to change its permission settings."
            readOnly={props.readOnly || isRoot}
            targetAccessControl={targetAccessControl}>
            { isRoot &&
                <Grid size={{ xs: 12 }}>
                    <Alert severity="info" variant="outlined">
                        The root administrator role implicitly grants all permissions and cannot be
                        modified.
                    </Alert>
                </Grid> }
        </PermissionSelector>
    );
}
