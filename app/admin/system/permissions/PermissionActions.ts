// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { AccessControl, kAnyEvent, kAnyTeam } from '@lib/auth/AccessControl';
import { LogBuilder } from '@lib/log/index';
import { executeServerAction } from '@lib/serverAction';
import { toPermissionList } from './toPermissionList';
import db, { tPermissionsRoles, tUsers } from '@lib/database';

/**
 * Data associated with an account permission update.
 */
const kAccountPermissionData = z.object({
    grants: z.any(),
    revokes: z.any(),
    events: z.array(z.string()),
    teams: z.array(z.string()),
    roles: z.array(z.string()).default([]),
});

/**
 * Server Action called when account permissions are being updated.
 */
export async function updateAccountPermissions(userId: number, formData: unknown) {
    return executeServerAction(formData, kAccountPermissionData, async (data, props) => {
        if (!props.access.can('system.permissions'))
            return { success: false, error: 'You are not able to update permissions' };

        const dbInstance = db;
        const existingAccessInfo = await dbInstance.selectFrom(tUsers)
            .where(tUsers.userId.equals(userId))
            .select({
                id: tUsers.userId,  // to ensure that an object is returned

                grants: tUsers.permissionsGrants,
                revokes: tUsers.permissionsRevokes,
                events: tUsers.permissionsEvents,
                teams: tUsers.permissionsTeams,
            })
            .executeSelectNoneOrOne();

        if (!existingAccessInfo)
            notFound();

        const existingAccess = new AccessControl(existingAccessInfo);
        if (existingAccess.can('root') && !props.access.can('root'))
            return { success: false, error: 'You are not allowed to update these permissions…' };

        if (!!data.roles?.includes('root') && !props.access.can('root') && !existingAccess.can('root'))
            return { success: false, error: 'You are not allowed to assign the "root" role…' };

        let grants: string | null = null;
        let revokes: string | null = null;

        try {
            if (!!data.grants)
                grants = toPermissionList(data.grants, props.access, existingAccess);

            if (!!data.revokes)
                revokes = toPermissionList(data.revokes, props.access, existingAccess);

        } catch (error: any) {
            return { success: false, error: error.message };
        }

        let finalGrants: string | null = null;
        {
            const grantList = [
                ...(data.roles ?? []),
                ...(grants ? grants.split(',') : []),
            ];

            if (grantList.length > 0)
                finalGrants = [ ...new Set(grantList) ].join(',');
        }

        let events: string | null = null;
        if (!!data.events.length)
            events = data.events.includes(kAnyEvent) ? kAnyEvent : data.events.join(',');

        let teams: string | null = null;
        if (!!data.teams.length)
            teams = data.teams.includes(kAnyTeam) ? kAnyTeam : data.teams.join(',');

        const affectedRows = await dbInstance.update(tUsers)
            .set({
                permissionsGrants: finalGrants,
                permissionsRevokes: revokes,
                permissionsEvents: events,
                permissionsTeams: teams,
            })
            .where(tUsers.userId.equals(userId))
            .executeUpdate();

        LogBuilder.for('AdminUpdatePermission')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withAffectedUser(userId)
            .withSeverity('Warning')
            .withDiff({
                grants: {
                    before: existingAccessInfo.grants || '',
                    after: finalGrants || '',
                },
                revokes: {
                    before: existingAccessInfo.revokes || '',
                    after: revokes || '',
                },
                events: {
                    before: existingAccessInfo.events || '',
                    after: events || '',
                },
                Teams: {
                    before: existingAccessInfo.teams || '',
                    after: teams || '',
                },
            })
            .record();

        return {
            success: true,
            refresh: true,
        };
    });
}

/**
 * Data associated with a role permission update.
 */
const kRolePermissionData = z.object({
    grants: z.any(),
    revokes: z.any(),
});

/**
 * Server Action called when role permissions are being updated.
 */
export async function updateRolePermissions(roleId: string, formData: unknown) {
    return executeServerAction(formData, kRolePermissionData, async (data, props) => {
        if (!props.access.can('system.permissions'))
            return { success: false, error: 'You are not able to update permissions' };

        if (roleId === 'root')
            return { success: false, error: 'The root role cannot be modified' };

        const dbInstance = db;
        const existingRoleInfo = await dbInstance.selectFrom(tPermissionsRoles)
            .where(tPermissionsRoles.permissionRoleId.equals(roleId))
            .select({
                id: tPermissionsRoles.permissionRoleId,
                grants: tPermissionsRoles.permissionRoleGrants,
                revokes: tPermissionsRoles.permissionRoleRevokes,
            })
            .executeSelectNoneOrOne();

        if (!existingRoleInfo)
            notFound();

        const existingAccess = new AccessControl(existingRoleInfo);
        if (existingAccess.can('root') && !props.access.can('root'))
            return { success: false, error: 'You are not allowed to update these permissions…' };

        let grants: string | null = null;
        let revokes: string | null = null;

        try {
            if (!!data.grants)
                grants = toPermissionList(data.grants, props.access, existingAccess);

            if (!!data.revokes)
                revokes = toPermissionList(data.revokes, props.access, existingAccess);

        } catch (error: any) {
            return { success: false, error: error.message };
        }

        const affectedRows = await dbInstance.update(tPermissionsRoles)
            .set({
                permissionRoleGrants: grants,
                permissionRoleRevokes: revokes,
            })
            .where(tPermissionsRoles.permissionRoleId.equals(roleId))
            .executeUpdate();

        if (!affectedRows)
            return { success: false, error: 'Unable to update permissions in the database…' };

        return {
            success: true,
            refresh: true,
        };
    });
}
