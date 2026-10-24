// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import AutoAwesomeMotionOutlinedIcon from '@mui/icons-material/AutoAwesomeMotionOutlined';

import type { Column, ExtractRowModel } from '@app/admin/components/DataTable';
import { Cache } from '@lib/cache';
import { DataTable, createDataSource, withRowModel } from '@app/admin/components/DataTable';
import { LogBuilder } from '@lib/log/index';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { requireAuthentication } from '@lib/requireAuthentication';
import db, { tEvents, tPermissionsRoles, tRoles, tUsers, tUsersEvents } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';
import { kRootRole } from '../Root';

/**
 * Set of roles that should be protected from being removed.
 */
const kProtectedRoles = new Set([ 'senior', 'staff' ]);

/**
 * Counts the number of distinct users granted each role, either globally on their account or via
 * an accepted participation in a non-hidden event.
 */
async function countUsersPerRole(dbInstance: typeof db): Promise<Map<string, number>> {
    const eventsJoin = tEvents.forUseInLeftJoin();
    const rolesJoin = tRoles.forUseInLeftJoin();
    const usersEventsJoin = tUsersEvents.forUseInLeftJoin();

    const users = await dbInstance.selectFrom(tUsers)
        .leftJoin(usersEventsJoin)
            .on(usersEventsJoin.userId.equals(tUsers.userId))
                .and(usersEventsJoin.registrationStatus.equals(kRegistrationStatus.Accepted))
        .leftJoin(eventsJoin)
            .on(eventsJoin.eventId.equals(usersEventsJoin.eventId))
                .and(eventsJoin.eventHidden.equals(/* false= */ 0))
        .leftJoin(rolesJoin)
            .on(rolesJoin.roleId.equals(usersEventsJoin.roleId))
                .and(rolesJoin.rolePermissionGrant.isNotNull())
                .and(eventsJoin.eventId.isNotNull())
        .where(tUsers.permissionsGrants.isNotNull()
            .or(rolesJoin.roleId.isNotNull()))
        .select({
            grants: tUsers.permissionsGrants,
            eventGrants: dbInstance.aggregateAsArrayOfOneColumn(rolesJoin.rolePermissionGrant),
        })
        .groupBy(tUsers.userId)
        .executeSelectMany();

    const counts = new Map<string, number>();
    for (const user of users) {
        const userRoles = new Set<string>();
        if (user.grants) {
            for (const grant of user.grants.split(',')) {
                const trimmed = grant.trim();
                if (trimmed)
                    userRoles.add(trimmed);
            }
        }

        for (const eventGrant of user.eventGrants) {
            if (eventGrant)
                userRoles.add(eventGrant);
        }

        for (const roleId of userRoles)
            counts.set(roleId, (counts.get(roleId) ?? 0) + 1);
    }

    return counts;
}

/**
 * Data source through which the configured permission roles can be retrieved.
 */
const rolesDataSource = createDataSource('admin/system/permissions/roles', withRowModel({
    /**
     * Unique ID of the role.
     */
    id: z.string(),

    /**
     * Name of the role as it should be presented.
     */
    name: z.string(),

    /**
     * Description of what this role represents.
     */
    description: z.string(),

    /**
     * Number of users who have been granted this role.
     */
    userCount: z.number(),

    /**
     * Whether this role is protected from updates.
     */
    frozen: z.boolean(),

    /**
     * Whether this role is protected from deletion.
     */
    protected: z.boolean(),

}), {
    async authorize(operation, props) {
        executeAccessCheck(props.authenticationContext, 'system.permissions');
    },

    async create(partialRow, props) {
        if (!partialRow.name || !partialRow.name.trim())
            return false;

        const name = partialRow.name.trim();
        const description = partialRow.description?.trim() || '';

        const roleId = name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 50);

        if (!roleId || roleId === 'root')
            return false;

        const dbInstance = db;
        const existing = await dbInstance.selectFrom(tPermissionsRoles)
            .where(tPermissionsRoles.permissionRoleId.equals(roleId))
            .selectOneColumn(tPermissionsRoles.permissionRoleId)
            .executeSelectNoneOrOne();

        if (existing)
            return false;

        const insertedRows = await dbInstance.insertInto(tPermissionsRoles)
            .set({
                permissionRoleId: roleId,
                permissionRoleName: name,
                permissionRoleDescription: description,
                permissionRoleGrants: null,
                permissionRoleRevokes: null,
            })
            .executeInsert();

        if (insertedRows) {
            Cache.getInstance('PermissionRoles').set(roleId, {
                grants: [ /* no grants */ ],
                revokes: [ /* no revokes */ ],
            });
        }

        LogBuilder.for('CreatePermissionRole')
            .withCondition(!!insertedRows)
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                role: roleId,
            });

        return !!insertedRows;
    },

    async delete(row, props) {
        if (row.id === 'root' || kProtectedRoles.has(row.id))
            return false;

        const dbInstance = db;
        const roleCounts = await countUsersPerRole(dbInstance);
        if ((roleCounts.get(row.id) ?? 0) > 0)
            return false;

        const affectedRows = await dbInstance.deleteFrom(tPermissionsRoles)
            .where(tPermissionsRoles.permissionRoleId.equals(row.id))
            .executeDelete();

        if (affectedRows)
            Cache.getInstance('PermissionRoles').delete(row.id);

        LogBuilder.for('DeletePermissionRole')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                role: row.id,
            });

        return !!affectedRows;
    },

    async list() {
        const dbInstance = db;
        const roleCounts = await countUsersPerRole(dbInstance);

        const dbRoles = await dbInstance.selectFrom(tPermissionsRoles)
            .where(tPermissionsRoles.permissionRoleId.notEquals('root'))
            .select({
                id: tPermissionsRoles.permissionRoleId,
                name: tPermissionsRoles.permissionRoleName,
                description: tPermissionsRoles.permissionRoleDescription,
            })
            .orderBy(tPermissionsRoles.permissionRoleName, 'asc')
            .executeSelectMany();

        const rows = [
            {
                ...kRootRole,
                userCount: roleCounts.get('root') ?? 0,
                frozen: true,
                protected: true,
            },
            ...dbRoles.map(role => {
                const userCount = roleCounts.get(role.id) ?? 0;
                return {
                    ...role,
                    userCount,
                    frozen: false,
                    protected: userCount > 0 || kProtectedRoles.has(role.id),
                };
            }),
        ].sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));

        return {
            rowCount: rows.length,
            rows,
        };
    },

    async update(row, previousRow, props) {
        if (row.id === 'root')
            return false;

        const name = row.name.trim();
        if (!name)
            return false;

        const description = row.description.trim();
        if (name === previousRow.name.trim() && description === previousRow.description?.trim())
            return true;

        const affectedRows = await db.update(tPermissionsRoles)
            .set({
                permissionRoleName: name,
                permissionRoleDescription: description,
            })
            .where(tPermissionsRoles.permissionRoleId.equals(row.id))
            .executeUpdate();

        LogBuilder.for('UpdatePermissionRole')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .withDiff({
                name: {
                    before: previousRow.name,
                    after: name,
                },
                description: {
                    before: previousRow.description,
                    after: description,
                },
            })
            .record({
                role: row.id,
            });

        return !!affectedRows;
    },
});

/**
 * The roles page displays an overview of all roles in the system and their assigned permissions.
 */
export default async function RolesPage() {
    await requireAuthentication('system.permissions');

    const columns: Column<ExtractRowModel<typeof rolesDataSource>>[] = [
        {
            field: 'name',
            headerName: 'Role',
            editable: true,
            sortable: false,
            flex: 2,

            editorProps: {
                required: true,
            },

            template: 'text',
            templateProps: {
                href: './roles/{id}',
            },
        },
        {
            field: 'description',
            headerName: 'Description',
            editable: true,
            sortable: false,
            flex: 4,
        },
        {
            field: 'userCount',
            headerName: 'Users',
            sortable: false,
            flex: 1,

            template: 'text',
            templateProps: {
                template: '{userCount} user(s)',
            },
        },
    ];

    return (
        <>
            <Section icon={ <AutoAwesomeMotionOutlinedIcon color="primary" /> }
                     title="Permission roles"
                     breadcrumbs={[
                         { label: 'System', href: '/admin/system' },
                         { label: 'Permissions', href: '/admin/system/permissions' },
                         { label: 'Roles' },
                     ]}>
                <SectionIntroduction>
                    Roles group permissions together and can be assigned to principals.
                </SectionIntroduction>
            </Section>
            <Section tabs noHeader>
                <DataTable
                    columns={columns}
                    defaultSort={{ field: 'name', sort: null }} pageSize={100}
                    protectedColumn="protected" frozenColumn="frozen"
                    disableFooter disableSearch
                    source={rolesDataSource}
                    subject="role"
                    listViewProps={{
                        primaryField: 'name',
                        secondaryField: 'description',
                        linkTemplate: '/admin/system/permissions/roles/{id}',
                    }} />
            </Section>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('Roles', 'Permissions', 'System');
