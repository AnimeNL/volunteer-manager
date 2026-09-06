// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import AutoAwesomeMotionOutlinedIcon from '@mui/icons-material/AutoAwesomeMotionOutlined';

import type { Column, ExtractRowModel } from '@app/admin/components/DataTable';
import { DataTable, createDataSource, withRowModel } from '@app/admin/components/DataTable';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { requireAuthentication } from '@lib/requireAuthentication';
import db, { tPermissionsRoles, tUsers } from '@lib/database';

/**
 * Root administrator role, which is implicitly available throughout the system.
 */
const kRootRole = {
    id: 'root',
    name: 'root',
    description: 'Role granting all permissions in the system without exceptions.',
};

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

        let roleId = name
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

        return !!insertedRows;
    },

    async delete(row, props) {
        if (row.id === 'root')
            return false;

        const dbInstance = db;
        const userCount = await dbInstance.selectFrom(tUsers)
            .where(dbInstance.fragmentWithType('boolean', 'required').sql`
                FIND_IN_SET(${dbInstance.const(row.id, 'string')} COLLATE utf8mb4_unicode_ci,
                            ${tUsers.permissionsGrants}) > 0`)
            .selectCountAll()
            .executeSelectOne();

        if (userCount > 0)
            return false;

        const affectedRows = await dbInstance.deleteFrom(tPermissionsRoles)
            .where(tPermissionsRoles.permissionRoleId.equals(row.id))
            .executeDelete();

        return !!affectedRows;
    },

    async list() {
        const usersJoin = tUsers.forUseInLeftJoin();

        const dbInstance = db;
        const rootUserCount = await dbInstance.selectFrom(tUsers)
            .where(dbInstance.fragmentWithType('boolean', 'required').sql`
                FIND_IN_SET('root', ${tUsers.permissionsGrants}) > 0`)
            .selectCountAll()
            .executeSelectOne();

        const dbRoles = await dbInstance.selectFrom(tPermissionsRoles)
            .leftJoin(usersJoin)
                .on(dbInstance.fragmentWithType('boolean', 'required').sql`
                    FIND_IN_SET(${tPermissionsRoles.permissionRoleId} COLLATE utf8mb4_unicode_ci,
                                ${usersJoin.permissionsGrants}) > 0`)
            .where(tPermissionsRoles.permissionRoleId.notEquals('root'))
            .select({
                id: tPermissionsRoles.permissionRoleId,
                name: tPermissionsRoles.permissionRoleName,
                description: tPermissionsRoles.permissionRoleDescription,
                userCount: dbInstance.count(usersJoin.userId),
            })
            .groupBy(tPermissionsRoles.permissionRoleId)
            .orderBy(tPermissionsRoles.permissionRoleName, 'asc')
            .executeSelectMany();

        const rows = [
            {
                ...kRootRole,
                userCount: rootUserCount,
                frozen: true,
                protected: true,
            },
            ...dbRoles.map(role => ({
                ...role,
                frozen: false,
                protected: role.userCount > 0,
            })),
        ].sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));

        return {
            rowCount: rows.length,
            rows,
        };
    },

    async update(row, previousRow) {
        if (row.id === 'root')
            return false;

        const description = row.description.trim();
        if (description === previousRow.description?.trim())
            return true;

        const affectedRows = await db.update(tPermissionsRoles)
            .set({
                permissionRoleDescription: description,
            })
            .where(tPermissionsRoles.permissionRoleId.equals(row.id))
            .executeUpdate();

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
