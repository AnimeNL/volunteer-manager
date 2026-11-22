// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import WorkOutlineOutlinedIcon from '@mui/icons-material/WorkOutlineOutlined';

import type { AccessDescriptor, AccessOperation } from '@lib/auth/access';
import type { Column, ExtractRowModel } from '@app/admin/components/DataTable';
import { AccessControl, executeAccessCheck } from '@lib/auth/access';
import { DataTable, createDataSource, withRowModel } from '@app/admin/components/DataTable';
import { LogBuilder } from '@lib/log/index';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { invalidateAuthCache, requireAuthenticationContext } from '@lib/auth';
import { requireAuthentication } from '@lib/requireAuthentication';
import { validatePermissionRestrictions } from '@app/admin/system/permissions/toPermissionList';
import db, { tPermissionsRoles, tRoles } from '@lib/database';

import { kCrudOperations } from '@app/admin/system/permissions/toPermissionList';
import { kPermissions } from '@lib/auth/access';

import { HotelEligibleHeaderCell, HotelEligibleCell, RestrictedDefaultHeaderCell,
    RestrictedDefaultCell, TrainingEligibleHeaderCell, TrainingEligibleCell }
        from '../StructureCells';

/**
 * Verifies whether a single permission identifier (or prefix / CRUD operation) is defined in
 * `kPermissions`.
 */
function isValidPermissionIdentifier(entry: string): boolean {
    const parts = entry.split(':');
    if (parts.length > 2)
        return false;

    const [ permission, operation ] = parts;
    if (operation !== undefined) {
        if (!Object.hasOwn(kPermissions, permission))
            return false;

        const descriptor: AccessDescriptor = kPermissions[permission as keyof typeof kPermissions];
        return descriptor.type === 'crud' &&
            kCrudOperations.includes(operation as AccessOperation);
    }

    if (Object.hasOwn(kPermissions, permission))
        return true;

    const prefix = `${permission}.`;
    return Object.keys(kPermissions).some(key => key.startsWith(prefix));
}

/**
 * Validates that every entry in a role's comma-separated `rolePermissionGrant` is either a known
 * permission role or a valid permission identifier, and adheres to assignment restrictions.
 */
async function validateRolePermissionGrant(
    grant: string, userAccess: AccessControl, existingGrant: string | null): Promise<boolean>
{
    const entries = grant.split(',').map(entry => entry.trim()).filter(Boolean);
    if (!entries.length)
        return true;

    const availableRoles = await db.selectFrom(tPermissionsRoles)
        .where(tPermissionsRoles.permissionRoleId.notEquals('root'))
        .select({
            id: tPermissionsRoles.permissionRoleId,
            grants: tPermissionsRoles.permissionRoleGrants,
        })
        .executeSelectMany();

    const knownRoles = new Map<string, string[]>();
    for (const role of availableRoles) {
        knownRoles.set(
            role.id,
            role.grants ? role.grants.split(',').map(g => g.trim()).filter(Boolean) : []);
    }

    const existingAccess = new AccessControl({ grants: existingGrant ?? undefined });

    for (const entry of entries) {
        const roleGrants = knownRoles.get(entry);
        const permissionsToCheck = roleGrants ?? [ entry ];

        if (!roleGrants && !isValidPermissionIdentifier(entry))
            return false;

        try {
            validatePermissionRestrictions(permissionsToCheck, userAccess, existingAccess);
        } catch {
            return false;
        }
    }

    return true;
}

/**
 * Data source used to populate and manage the roles table.
 */
const rolesDataSource = createDataSource('organisation/structure/roles', withRowModel({
    /**
     * Unique ID of the role.
     */
    id: z.number(),

    /**
     * Name of the role as it should be presented to other people.
     */
    roleName: z.string(),

    /**
     * The permission grant that should be given to people holding this role.
     */
    rolePermissionGrant: z.string().nullish(),

    /**
     * The number of events the volunteer can indicate they really want to attend.
     */
    availabilityEventLimit: z.number(),

    /**
     * Whether the role should be restricted from being assigned as a default role.
     */
    flagDefaultRestricted: z.boolean(),

    /**
     * Whether volunteers in this role are eligible to book a hotel room.
     */
    hotelEligible: z.boolean(),

    /**
     * Whether volunteers in this role are eligible to book a training.
     */
    trainingEligible: z.boolean(),

}), {
    async authorize(operation, props) {
        if (operation === 'read') {
            executeAccessCheck(props.authenticationContext, {
                permission: 'organisation.roles',
                operation,
            });
        } else {
            await requireAuthenticationContext(
                { permission: 'organisation.roles', operation },
                undefined,
                { bypassCache: true });
        }
    },

    async create(partialRow, props) {
        const kDefaultAvailabilityEventLimit = 3;
        const kDefaultRoleName = partialRow.roleName || 'New role';

        const dbInstance = db;
        const insertId = await dbInstance.insertInto(tRoles)
            .set({
                roleName: kDefaultRoleName,
                roleOrder: /* first= */ 0,
                roleAvailabilityEventLimit: kDefaultAvailabilityEventLimit,
                roleFlagDefaultRestricted: /* false= */ 0,
                roleHotelEligible: /* false= */ 0,
                roleTrainingEligible: /* false= */ 0,
            })
            .returningLastInsertedId()
            .executeInsert();

        LogBuilder.for('CreateRole')
            .withCondition(!!insertId)
            .withInitiatorUser(props.user)
            .withSeverity('Error')
            .record({
                role: kDefaultRoleName,
            });

        return !!insertId;
    },

    async list(params) {
        const roles = await db.selectFrom(tRoles)
            .where(
                tRoles.roleName.containsInsensitiveIfValue(params.search).or(
                tRoles.rolePermissionGrant.containsInsensitiveIfValue(params.search)))
            .select({
                id: tRoles.roleId,
                roleName: tRoles.roleName,
                rolePermissionGrant: tRoles.rolePermissionGrant,
                availabilityEventLimit: tRoles.roleAvailabilityEventLimit,
                flagDefaultRestricted: tRoles.roleFlagDefaultRestricted.equals(/* true= */ 1),
                hotelEligible: tRoles.roleHotelEligible.equals(/* true= */ 1),
                trainingEligible: tRoles.roleTrainingEligible.equals(/* true= */ 1),
            })
            .orderBy(tRoles.roleOrder, 'asc')
            .executeSelectMany();

        return {
            rowCount: roles.length,
            rows: roles,
        };
    },

    async reorder(order) {
        const dbInstance = db;
        await dbInstance.transaction(async () => {
            for (let index = 0; index < order.length; ++index) {
                await dbInstance.update(tRoles)
                    .set({ roleOrder: index })
                    .where(tRoles.roleId.equals(order[index]))
                    .executeUpdate();
            }
        });

        return true;
    },

    async update(updatedRow, previousRow, props) {
        const existingRole = await db.selectFrom(tRoles)
            .where(tRoles.roleId.equals(updatedRow.id))
            .select({
                rolePermissionGrant: tRoles.rolePermissionGrant,
            })
            .executeSelectNoneOrOne();

        if (!existingRole)
            return false;

        const existingGrant = existingRole.rolePermissionGrant?.trim() || null;
        const nextGrant = updatedRow.rolePermissionGrant?.trim() || null;

        if (nextGrant !== existingGrant) {
            const { access: freshAccess } = await requireAuthenticationContext(
                'system.permissions', undefined, { bypassCache: true });

            if (nextGrant) {
                const valid = await validateRolePermissionGrant(
                    nextGrant, freshAccess, existingGrant);

                if (!valid)
                    return false;
            }
        }

        const affectedRows = await db.update(tRoles)
            .set({
                roleName: updatedRow.roleName,
                rolePermissionGrant: nextGrant,
                roleAvailabilityEventLimit: updatedRow.availabilityEventLimit,
                roleFlagDefaultRestricted: updatedRow.flagDefaultRestricted ? 1 : 0,
                roleHotelEligible: updatedRow.hotelEligible ? 1 : 0,
                roleTrainingEligible: updatedRow.trainingEligible ? 1 : 0,
            })
            .where(tRoles.roleId.equals(updatedRow.id))
            .executeUpdate();

        if (affectedRows)
            invalidateAuthCache();

        LogBuilder.for('UpdateRole')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withSeverity('Error')
            .record({
                role: updatedRow.roleName,
            });

        return !!affectedRows;
    },
});

/**
 * The <RolesPage> component enables the volunteer to adjust the roles that are available on the
 * Volunteer Manager. Roles define what function people exercise within our organisation.
 */
export default async function RolesPage() {
    const { access } = await requireAuthentication({
        permission: 'organisation.roles',
        operation: 'read',
    });

    const columns: Column<ExtractRowModel<typeof rolesDataSource>>[] = [
        {
            field: 'roleName',
            headerName: 'Role',
            editable: true,
            sortable: false,
            flex: 2,
        },
        {
            field: 'availabilityEventLimit',
            align: 'center',
            headerName: 'Event flag limit',
            headerAlign: 'center',
            description: 'Their event availability limit',
            editable: true,
            sortable: false,
            type: 'number',
            flex: 1,
        },
        {
            field: 'rolePermissionGrant',
            align: 'center',
            headerName: 'Permission',
            headerAlign: 'center',
            description: 'Permission (scoped) granted to this role',
            editable: access.can('system.permissions'),
            sortable: false,
            flex: 1,
        },
        {
            field: 'flagDefaultRestricted',
            align: 'center',
            headerName: 'Restricted',
            headerAlign: 'center',
            description: 'Restricted from being a team\'s default role?',
            editable: true,
            sortable: false,
            type: 'boolean',
            width: 50,

            template: 'component',
            templateProps: {
                headerComponent: RestrictedDefaultHeaderCell,
                component: RestrictedDefaultCell,
            },
        },
        {
            field: 'hotelEligible',
            align: 'center',
            headerName: 'Hotel',
            headerAlign: 'center',
            description: 'Eligible to book hotel rooms?',
            editable: true,
            sortable: false,
            type: 'boolean',
            width: 50,

            template: 'component',
            templateProps: {
                headerComponent: HotelEligibleHeaderCell,
                component: HotelEligibleCell,
            },
        },
        {
            field: 'trainingEligible',
            align: 'center',
            headerName: 'Training',
            headerAlign: 'center',
            description: 'Eligible to participate in training?',
            editable: true,
            sortable: false,
            type: 'boolean',
            width: 50,

            template: 'component',
            templateProps: {
                headerComponent: TrainingEligibleHeaderCell,
                component: TrainingEligibleCell,
            },
        },
    ];

    const canFullyMutateRoles =
        access.can('organisation.roles', 'create') &&
        access.can('organisation.roles', 'update');

    return (
        <>
            <Section icon={ <WorkOutlineOutlinedIcon color="primary" /> } title="Roles"
                     limited={!canFullyMutateRoles}
                     documentation="organisation/structure" breadcrumbs={[
                { label: 'Organisation', href: '/admin/organisation' },
                { label: 'Structure', href: '/admin/organisation/structure' },
                { label: 'Roles' },
            ]}>
                <SectionIntroduction>
                    Selection of roles in our organisation that volunteers can be assigned to.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                <DataTable columns={columns} source={rolesDataSource}
                           defaultSort={{ field: 'id', sort: 'asc' }}
                           disableFooter disableSearch pageSize={100}
                           subject="role"
                           listViewProps={{
                               primaryField: 'roleName',
                           }} />
            </Section>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('Roles', 'Structure', 'Organisation');
