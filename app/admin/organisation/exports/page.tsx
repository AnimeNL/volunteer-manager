// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import { DataTable, createDataSource, withRowModel, type Column, type ExtractRowModel }
    from '@app/admin/components/DataTable';
import { ExportAvailabilityCell } from './ExportsRowComponents';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck, requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tEvents, tExportsLogs, tExports, tUsers } from '@lib/database';

/**
 * Data source through which the Exports data table can be populated.
 */
const exportsDataSource = createDataSource('admin/organisation/exports', withRowModel({
    /**
     * Unique ID of the export.
     */
    id: z.number(),

    /**
     * Whether the export is enabled, i.e. it hasn't been manually revoked.
     */
    enabled: z.boolean(),

    /**
     * Context event and data type of the exported data.
     */
    context: z.string().optional(),

    /**
     * Reason describing what motivated exporting the data.
     */
    reason: z.string(),

    /**
     * Volunteer who is responsible for the exported data.
     */
    responsible: z.object({
        id: z.number(),
        name: z.string(),
    }),

    /**
     * Date at which the export will cease to be available.
     */
    expirationDate: z.string(),

    /**
     * Maximum number of views after which the export will expire.
     */
    expirationViews: z.number(),

    /**
     * Number of views that the export has received so far.
     */
    views: z.number(),

}), {
    async authorize(operation, props) {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin',
            permission: 'organisation.exports',
        });
    },

    async list(params, props) {
        const exportsLogsJoin = tExportsLogs.forUseInLeftJoin();

        let sortField: 'context' | 'expirationDate' | 'responsible.name' | 'views'
            = 'expirationDate';

        switch (params.sort.field) {
            case 'context':
            case 'expirationDate':
            case 'views':
                sortField = params.sort.field as 'context' | 'expirationDate' | 'views';
                break;
            case 'responsible':
                sortField = 'responsible.name';
                break;
        }

        const dbInstance = db;
        const results = await dbInstance.selectFrom(tExports)
            .innerJoin(tEvents)
                .on(tEvents.eventId.equals(tExports.exportEventId))
            .innerJoin(tUsers)
                .on(tUsers.userId.equals(tExports.exportCreatedUserId))
            .leftJoin(exportsLogsJoin)
                .on(exportsLogsJoin.exportId.equals(tExports.exportId))
            .where(
                tEvents.eventShortName.containsInsensitiveIfValue(params.search).or(
                tExports.exportJustification.containsInsensitiveIfValue(params.search).or(
                tUsers.name.containsInsensitiveIfValue(params.search)
            )))
            .select({
                id: tExports.exportId,
                enabled: tExports.exportEnabled.equals(/* true= */ 1),
                context: tEvents.eventShortName.concat(' ').concat(tExports.exportType as any),
                reason: tExports.exportJustification,
                responsible: {
                    id: tUsers.userId,
                    name: tUsers.name,
                },
                expirationDate: dbInstance.dateTimeAsString(tExports.exportExpirationDate),
                expirationViews: tExports.exportExpirationViews,
                views: dbInstance.count(exportsLogsJoin.accessDate),
            })
            .groupBy(tExports.exportId)
            .orderBy(sortField, params.sort.direction)
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        return {
            rowCount: results.count,
            rows: results.data,
        };
    }
});

/**
 * The <OrganisationExportsPage> component displays a data table with all exports logs that
 * have ever been created on the Volunteering Manager. They can be clicked through to see more info
 * on what was exported by who, and when it was accessed.
 */
export default async function OrganisationExportsPage() {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'organisation.exports'
    });

    const columns: Column<ExtractRowModel<typeof exportsDataSource>>[] = [
        {
            field: 'enabled',
            headerName: '',
            sortable: false,
            align: 'center',
            width: 50,

            template: 'component',
            templateProps: {
                component: ExportAvailabilityCell,
            },
        },
        {
            field: 'context',
            headerName: 'Exported data',
            flex: 2,

            template: 'text',
            templateProps: {
                href: '/admin/organisation/exports/{id}',
                template: '{context} ({reason})',
            },
        },
        {
            field: 'responsible',
            headerName: 'Responsible',
            flex: 1,

            template: 'account',
        },
        {
            field: 'expirationDate',
            headerName: 'Expiration',
            width: 125,

            template: 'date',
            templateProps: {
                format: 'YYYY-MM-DD',
            },
        },
        {
            field: 'views',
            headerName: 'Views',
            width: 125,

            template: 'number',
            templateProps: {
                limit: 'expirationViews',
            },
        },
    ];

    return (
        <DataTable columns={columns} source={exportsDataSource}
                   defaultSort={{ field: 'expirationDate', sort: 'desc' }}
                   pageSize={25}
                   listViewProps={{
                       primaryField: 'context',
                       secondaryField: 'reason',
                       dateField: 'expirationDate',
                       dateFieldFormat: 'YYYY-MM-DD',
                       startComponent: ExportAvailabilityCell,
                       linkTemplate: '/admin/organisation/exports/{id}',
                   }} />
    );
}

export const generateMetadata = createGenerateMetadataFn('Exports', 'Organisation');
