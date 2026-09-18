// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import { DataTable, createDataSource, kEventTransformer, withContext, withRowModel, type Column,
    type ExtractRowModel } from '@app/admin/components/DataTable';
import { LogBuilder } from '@app/lib/log/index';
import { ScheduleCache } from '@app/api/event/schedule/ScheduleCache';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { readSetting } from '@lib/Settings';
import db, { tVendors } from '@lib/database';

import type { ShirtFit, ShirtSize, VendorTeam } from '@lib/database/Types';
import { kAnyTeam } from '@lib/auth/AccessControl';
import { kShirtFit, kShirtSize, kVendorGender, kVendorTeam } from '@lib/database/Types';

/**
 * Names of the known vendor teams, for presentation in user interfaces.
 */
export const kVendorTeamName: { [k in VendorTeam]: string } = {
    [kVendorTeam.FirstAid]: 'First Aid',
    [kVendorTeam.Security]: 'Security',
};

/**
 * Data source through which vendor team members can be managed.
 */
const vendorDataSource = createDataSource('admin/events/vendor-team', withContext({
    /**
     * Event for which the vendor team is being displayed.
     */
    event: kEventTransformer,

    /**
     * Name of the vendor team for which data is being shown.
     */
    team: z.enum(kVendorTeam),

}), withRowModel({
    /**
     * Unique ID of the vendor.
     */
    id: z.number(),

    /**
     * First name of the vendor.
     */
    firstName: z.string().nonempty(),

    /**
     * Last name of the vendor.
     */
    lastName: z.string().nonempty(),

    /**
     * Role that has been assigned to this vendor.
     */
    role: z.string().nonempty(),

    /**
     * Gender of the vendor.
     */
    gender: z.enum(kVendorGender),

    /**
     * T-shirt size of the vendor.
     */
    shirtSize: z.string().nullish(),

    /**
     * T-shirt fit of the vendor.
     */
    shirtFit: z.string().nullish(),

}), {
    async authorize(operation, props, context) {
        executeAccessCheck(props.authenticationContext, {
            permission: 'volunteers.vendor-teams',
            operation: operation,
            scope: {
                event: context.event.slug,
                team: kAnyTeam,
            },
        });
    },

    async create(partialRow, props, context) {
        let roleSetting: string;
        switch (context.team) {
            case kVendorTeam.FirstAid:
                roleSetting = await readSetting('vendor-first-aid-roles') ?? 'First Aid';
                break;

            case kVendorTeam.Security:
                roleSetting = await readSetting('vendor-security-roles') ?? 'Security';
                break;

            default:
                throw new Error(`Invalid vendor team selected: ${context.team}`);
        }

        const roles = roleSetting.split(',').map(role => role.trim());
        const defaultRole = roles[0];

        const firstName = partialRow.firstName?.trim() || 'First';
        const lastName = partialRow.lastName?.trim() || 'Name';
        const role = partialRow.role?.trim() || defaultRole;
        const gender = partialRow.gender || kVendorGender.Other;
        const shirtSize = (partialRow.shirtSize?.trim() || null) as ShirtSize | null;
        const shirtFit = (partialRow.shirtFit?.trim() || null) as ShirtFit | null;

        const dbInstance = db;
        const insertId = await dbInstance.insertInto(tVendors)
            .set({
                eventId: context.event.id,
                vendorTeam: context.team,
                vendorFirstName: firstName,
                vendorLastName: lastName,
                vendorRole: role,
                vendorGender: gender,
                vendorShirtFit: shirtFit,
                vendorShirtSize: shirtSize,
                vendorModified: dbInstance.currentZonedDateTime(),
                vendorVisible: /* true= */ 1,
            })
            .returningLastInsertedId()
            .executeInsert();

        ScheduleCache.clear('vendors', context.event.id);

        LogBuilder.for('CreateVendor')
            .withCondition(!!insertId)
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                event: context.event.shortName,
                vendor: kVendorTeamName[context.team],
                name: `${firstName} ${lastName}`,
            });

        return !!insertId;
    },

    async delete(row, props, context) {
        const affectedRows = await db.update(tVendors)
            .set({ vendorVisible: /* false= */ 0 })
            .where(tVendors.vendorId.equals(row.id))
                .and(tVendors.eventId.equals(context.event.id))
                .and(tVendors.vendorTeam.equals(context.team))
                .and(tVendors.vendorVisible.equals(/* true= */ 1))
            .executeUpdate();

        ScheduleCache.clear('vendors', context.event.id);

        LogBuilder.for('DeleteVendor')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                event: context.event.shortName,
                vendor: kVendorTeamName[context.team],
                name: `${row.firstName} ${row.lastName}`,
            });

        return !!affectedRows;
    },

    async list(params, props, context) {
        const vendors = await db.selectFrom(tVendors)
            .where(tVendors.eventId.equals(context.event.id))
                .and(tVendors.vendorTeam.equals(context.team))
                .and(tVendors.vendorVisible.equals(/* true= */ 1))
            .select({
                id: tVendors.vendorId,
                firstName: tVendors.vendorFirstName,
                lastName: tVendors.vendorLastName,
                role: tVendors.vendorRole,
                gender: tVendors.vendorGender,
                shirtSize: tVendors.vendorShirtSize,
                shirtFit: tVendors.vendorShirtFit,
            })
            .orderBy('firstName', 'asc')
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        return {
            rowCount: vendors.count,
            rows: vendors.data,
        };
    },

    async update(row, previousRow, props, context) {
        const shirtFit = (row.shirtFit?.trim() || null) as ShirtFit | null;
        const shirtSize = (row.shirtSize?.trim() || null) as ShirtSize | null;

        const dbInstance = db;
        const affectedRows = await dbInstance.update(tVendors)
            .set({
                vendorFirstName: row.firstName,
                vendorLastName: row.lastName,
                vendorRole: row.role,
                vendorGender: row.gender,
                vendorShirtFit: shirtFit,
                vendorShirtSize: shirtSize,
                vendorModified: dbInstance.currentZonedDateTime(),
            })
            .where(tVendors.eventId.equals(context.event.id))
                .and(tVendors.vendorId.equals(row.id))
                .and(tVendors.vendorTeam.equals(context.team))
                .and(tVendors.vendorVisible.equals(/* true= */ 1))
            .executeUpdate();

        ScheduleCache.clear('vendors', context.event.id);

        LogBuilder.for('UpdateVendor')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                event: context.event.shortName,
                vendor: kVendorTeamName[context.team],
                name: `${row.firstName} ${row.lastName}`,
            });

        return !!affectedRows;
    },
});

/**
 * Props accepted by the <VendorTable> component.
 */
interface VendorTableProps {
    /**
     * Unique slug of the event for which the table is being displayed.
     */
    event: string;

    /**
     * Name of the vendor team for which data is being shown.
     */
    team: VendorTeam;

    /**
     * Whether the vendor information should be in read only mode.
     */
    readOnly?: boolean;

    /**
     * Roles that can be assigned to each of the vendors.
     */
    roles: string[];
}

/**
 * The <VendorTable> displays an editable table with the details of a particular vendor team.
 */
export function VendorTable(props: VendorTableProps) {
    const teamSpecificColumns: Column<ExtractRowModel<typeof vendorDataSource>>[] = [];
    switch (props.team) {
        case kVendorTeam.FirstAid:
            teamSpecificColumns.push({
                field: 'shirtSize',
                headerName: 'T-shirt size',
                editable: !props.readOnly,
                flex: 2,

                type: 'singleSelect',
                valueOptions: [ /* empty= */ ' ', ...Object.values(kShirtSize) ],
            });

            teamSpecificColumns.push({
                field: 'shirtFit',
                headerName: 'T-shirt fit',
                editable: !props.readOnly,
                flex: 2,

                type: 'singleSelect',
                valueOptions: [ /* empty= */ ' ', ...Object.values(kShirtFit) ],
            });

            break;
    }

    const columns: Column<ExtractRowModel<typeof vendorDataSource>>[] = [
        {
            field: 'firstName',
            headerName: 'First name',
            editable: !props.readOnly,
            flex: 3,

            editorProps: {
                required: true,
            },
        },
        {
            field: 'lastName',
            headerName: 'Last name',
            editable: !props.readOnly,
            flex: 3,

            editorProps: {
                required: true,
            },
        },
        {
            field: 'role',
            headerName: 'Role',
            editable: !props.readOnly,
            flex: 3,

            type: 'singleSelect',
            valueOptions: props.roles,

            editorProps: {
                required: true,
            },
        },
        {
            field: 'gender',
            headerName: 'Gender',
            editable: !props.readOnly,
            flex: 2,

            type: 'singleSelect',
            valueOptions: Object.values(kVendorGender),

            editorProps: {
                required: true,
            },
        },
        ...teamSpecificColumns,
    ];

    return (
        <DataTable columns={columns} source={vendorDataSource}
                   context={{ event: props.event, team: props.team }}
                   defaultSort={{ field: 'firstName', sort: 'asc' }}
                   disableFooter refreshOnMutation
                   subject="vendor"
                   listViewProps={{
                       primaryTemplate: '{firstName} {lastName}',
                       secondaryField: 'role',
                   }} />
    );
}
