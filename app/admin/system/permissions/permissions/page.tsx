// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden } from 'next/navigation';
import { z } from 'zod/v4';

import KeyIcon from '@mui/icons-material/Key';

import type { Column } from '@app/admin/components/DataTable';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { DangerousCell, DangerousHeader } from '../PermissionCells';
import { DataTable, createDataSource, withRowModel } from '@app/admin/components/DataTable';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { LogBuilder } from '@lib/log/index';
import { requireAuthentication } from '@lib/requireAuthentication';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import db, { tPermissions } from '@lib/database';

import { kPermissions } from '@lib/auth/Access';

/**
 * Row model representing a permission in the data table.
 */
const kPermissionRowModel = withRowModel({
    /**
     * Unique identifier (key) of the permission.
     */
    id: z.string(),

    /**
     * Name of the permission as presented to administrators.
     */
    name: z.string().optional(),

    /**
     * Description of what this permission grants access to.
     */
    description: z.string().optional(),

    /**
     * The type of the permission.
     */
    type: z.enum([ 'Boolean', 'CRUD' ]),

    /**
     * Operations that should be displayed for CRUD permissions.
     */
    operations: z.array(z.string()).optional(),

    /**
     * Whether this is a dangerous permission that warrants caution.
     */
    warning: z.boolean().optional(),
});

/**
 * Type representing a row in the permissions data table.
 */
type PermissionRow = z.infer<typeof kPermissionRowModel>;

/**
 * Data source used to populate and manage the permissions table.
 */
const permissionsDataSource = createDataSource('admin/system/permissions', kPermissionRowModel, {
    async authorize(operation, props) {
        executeAccessCheck(props.authenticationContext, 'system.permissions');
    },

    async list() {
        const permissions = await db.selectFrom(tPermissions)
            .select({
                id: tPermissions.permissionId,
                name: tPermissions.permissionName,
                description: tPermissions.permissionDescription,
                operations: tPermissions.permissionOperations,
                warning: tPermissions.permissionWarning.equals(/* true= */ 1),
            })
            .executeSelectMany();

        const permissionMap = new Map<string, typeof permissions[number]>();
        for (const row of permissions)
            permissionMap.set(row.id, row);

        const rows: PermissionRow[] = [];
        for (const [ key, descriptor ] of Object.entries(kPermissions)) {
            if (key === 'root')
                continue;  // ignore the "root" permission

            if (key.startsWith('test.'))
                continue;  // ignore permissions internal to the system

            const permission = permissionMap.get(key);

            rows.push({
                id: key,
                name: permission?.name,
                description: permission?.description,
                type: descriptor.type === 'crud' ? 'CRUD' : 'Boolean',
                operations: permission?.operations?.split(',').filter(Boolean).sort(),
                warning: permission?.warning,
            });
        }

        rows.sort((a, b) => a.id.localeCompare(b.id));

        return {
            rowCount: rows.length,
            rows,
        };
    },

    async update(updatedRow, previousRow, props) {
        if (updatedRow.id.startsWith('test.'))
            forbidden();

        const permissionName = updatedRow.name ?? '';
        const permissionDescription = updatedRow.description ?? '';
        const permissionWarning = updatedRow.warning ? 1 : 0;

        const permissionOperations = updatedRow.operations && updatedRow.operations.length > 0
            ? updatedRow.operations.join(',')
            : null;

        await db.insertInto(tPermissions)
            .set({
                permissionId: updatedRow.id,
                permissionName,
                permissionDescription,
                permissionOperations,
                permissionWarning,
            })
            .onConflictDoUpdateSet({
                permissionName,
                permissionDescription,
                permissionOperations,
                permissionWarning,
            })
            .executeInsert();

        LogBuilder.for('UpdatePermission')
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                permission: updatedRow.id,
            });

        return true;
    },
});

/**
 * The permissions page displays an overview of all permissions known to the Volunteer Manager,
 * with descriptions and details about who has access to them.
 */
export default async function PermissionsPage() {
    await requireAuthentication('system.permissions');

    const columns: Column<PermissionRow>[] = [
        {
            field: 'id',
            headerName: 'Permission',
            sortable: false,
            flex: 2,
        },
        {
            field: 'name',
            headerName: 'Name',
            editable: true,
            sortable: false,
            flex: 2,

            template: 'text',
            templateProps: {
                defaultValue: 'Unknown',
            },
        },
        {
            field: 'description',
            headerName: 'Description',
            editable: true,
            sortable: false,
            flex: 3,

            template: 'text',
            templateProps: {
                defaultValue: 'Unknown',
            },
        },
        {
            field: 'type',
            headerName: 'Type',
            sortable: false,
            width: 100,
        },
        {
            field: 'operations',
            headerName: 'Operations',
            editable: true,
            sortable: false,
            flex: 2,

            type: 'multiSelect',
            valueOptions: [ 'create', 'read', 'update', 'delete' ],
        },
        {
            field: 'warning',
            align: 'center',
            headerName: 'Dangerous',
            headerAlign: 'center',
            description: 'Is this a dangerous permission?',
            editable: true,
            sortable: false,
            type: 'boolean',
            width: 50,

            template: 'component',
            templateProps: {
                headerComponent: DangerousHeader,
                component: DangerousCell,
            },
        },
    ];

    return (
        <>
            <Section icon={ <KeyIcon color="primary" /> } title="Permissions"
                     breadcrumbs={[
                         { label: 'System', href: '/admin/system' },
                         { label: 'Permissions', href: '/admin/system/permissions' },
                         { label: 'Permissions' },
                     ]}>
                <SectionIntroduction>
                    Individual permissions that control access to capabilities within the Volunteer
                    Manager.
                </SectionIntroduction>
            </Section>
            <Section tabs noHeader>
                <DataTable columns={columns}
                           defaultSort={{ field: 'id', sort: 'asc' }}
                           disableFooter disableSearch pageSize={100}
                           listViewProps={{
                               primaryField: 'name',
                               secondaryField: 'id',
                           }}
                           source={permissionsDataSource}
                           subject="permission" />
            </Section>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('Permissions', 'System');
