// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';

import type { ServerAction } from '@lib/serverAction';
import { AccessControl } from '@lib/auth/AccessControl';
import { PermissionSelector } from './PermissionSelector';

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
     * Comma-separated list of permissions granted to this role.
     */
    grants?: string;

    /**
     * Whether the permissions should be displayed as read-only.
     */
    readOnly?: boolean;

    /**
     * Comma-separated list of permissions revoked from this role.
     */
    revokes?: string;

    /**
     * Unique ID of the role whose permissions are being configured.
     */
    roleId: string;
}

/**
 * The <RolePermissionSelector> component displays the permissions that have been granted to the
 * given role, as indicated in the `props`. The settings can be updated in real time.
 */
export function RolePermissionSelector(props: RolePermissionSelectorProps) {
    const isRoot = props.roleId === 'root';

    const targetAccessControl = new AccessControl({
        grants: isRoot ? 'root' : props.grants,
        revokes: isRoot ? undefined : props.revokes,
    });

    return (
        <PermissionSelector
            access={props.access}
            action={props.action}
            readOnly={props.readOnly || isRoot}
            targetAccessControl={targetAccessControl}>
            { isRoot &&
                <Grid size={{ xs: 12 }}>
                    <Alert severity="info" variant="outlined">
                        <strong>root</strong> implicitly grants all permissions and cannot be
                        modified.
                    </Alert>
                </Grid> }
        </PermissionSelector>
    );
}
