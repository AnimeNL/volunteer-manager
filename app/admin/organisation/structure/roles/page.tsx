// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import WorkOutlineOutlinedIcon from '@mui/icons-material/WorkOutlineOutlined';

import type { Column, ExtractRowModel } from '@app/admin/components/DataTable';
import { DataTable, createDataSource, withRowModel } from '@app/admin/components/DataTable';
import { LogBuilder } from '@lib/log/index';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { requireAuthentication } from '@lib/requireAuthentication';
import db, { tRoles } from '@lib/database';

import { HotelEligibleHeaderCell, HotelEligibleCell, RestrictedDefaultHeaderCell,
    RestrictedDefaultCell, TrainingEligibleHeaderCell, TrainingEligibleCell }
        from '../StructureCells';

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
        executeAccessCheck(props.authenticationContext, {
            permission: 'organisation.roles',
            operation,
        });
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
        const affectedRows = await db.update(tRoles)
            .set({
                roleName: updatedRow.roleName,
                rolePermissionGrant: updatedRow.rolePermissionGrant || null,
                roleAvailabilityEventLimit: updatedRow.availabilityEventLimit,
                roleFlagDefaultRestricted: updatedRow.flagDefaultRestricted ? 1 : 0,
                roleHotelEligible: updatedRow.hotelEligible ? 1 : 0,
                roleTrainingEligible: updatedRow.trainingEligible ? 1 : 0,
            })
            .where(tRoles.roleId.equals(updatedRow.id))
            .executeUpdate();

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
    await requireAuthentication({
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
            editable: true,
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

    return (
        <>
            <Section icon={ <WorkOutlineOutlinedIcon color="primary" /> } title="Roles"
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
