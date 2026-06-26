// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import { DataTable, createDataSource, withRowModel, type Column, type ExtractRowModel }
    from '@app/admin/components/DataTable';
import { HelpRequestStatusCell, HelpRequestTargetCell } from './HelpRequestRowComponents';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck, requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tDisplays, tDisplaysRequests, tEvents, tUsers } from '@lib/database';

import { kDisplayHelpRequestTarget } from '@lib/database/Types';

/**
 * Data source through which the help requests can be retrieved.
 */
const helpRequestsDataSource = createDataSource('admin/organisation/displayRequests', withRowModel({
    /**
     * Unique ID of the request as it exists in the database.
     */
    id: z.number(),

    /**
     * Date and time at which the request was received, in Temporal ZDT-compatible formatting.
     */
    date: z.string(),

    /**
     * Team / individual target of the received help request.
     */
    target: z.enum(kDisplayHelpRequestTarget),

    /**
     * Name of the display from which the request was issued.
     */
    display: z.string(),

    /**
     * Name of the event for which the request was issued.
     */
    event: z.string(),

    /**
     * Name, user ID and date of the time that the request was acknowledged.
     */
    acknowledgedBy: z.string().optional(),
    acknowledgedByUserId: z.number().optional(),
    acknowledgedDate: z.string().optional(),

    /**
     * Name, user ID, date and reason of the time that the request was closed.
     */
    closedBy: z.string().optional(),
    closedByUserId: z.number().optional(),
    closedDate: z.string().optional(),
    closedReason: z.string().optional(),

}), {
    async authorize(operation, props) {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin',
            permission: 'organisation.displays',
        });
    },

    async list(params, props) {
        const acknowledgedUserJoin = tUsers.forUseInLeftJoinAs('auj');
        const closedUserJoin = tUsers.forUseInLeftJoinAs('cuj');

        let sortField: 'date' | 'display' | 'event' | 'target' = 'date';
        switch (params.sort.field) {
            case 'date':
            case 'display':
            case 'event':
            case 'target':
                sortField = params.sort.field as any;
                break;
        }

        const dbInstance = db;
        const requests = await dbInstance.selectFrom(tDisplaysRequests)
            .innerJoin(tDisplays)
                .on(tDisplays.displayId.equals(tDisplaysRequests.displayId))
            .innerJoin(tEvents)
                .on(tEvents.eventId.equals(tDisplaysRequests.requestEventId))
            .leftJoin(acknowledgedUserJoin)
                .on(acknowledgedUserJoin.userId.equals(tDisplaysRequests.requestAcknowledgedBy))
            .leftJoin(closedUserJoin)
                .on(closedUserJoin.userId.equals(tDisplaysRequests.requestClosedBy))
            .where(
                tDisplays.displayLabel.containsIfValue(params.search).or(
                tDisplays.displayIdentifier.containsIfValue(params.search).or(
                tEvents.eventShortName.containsIfValue(params.search)
            )))
            .select({
                id: tDisplaysRequests.requestId,
                date: dbInstance.dateTimeAsString(tDisplaysRequests.requestReceivedDate),
                target: tDisplaysRequests.requestReceivedTarget,
                display: tDisplays.displayLabel.valueWhenNull(tDisplays.displayIdentifier),
                event: tEvents.eventShortName,

                acknowledgedBy: acknowledgedUserJoin.name,
                acknowledgedByUserId: acknowledgedUserJoin.userId,
                acknowledgedDate: dbInstance.dateTimeAsString(
                    tDisplaysRequests.requestAcknowledgedDate),

                closedBy: closedUserJoin.name,
                closedByUserId: closedUserJoin.userId,
                closedDate: dbInstance.dateTimeAsString(tDisplaysRequests.requestClosedDate),
                closedReason: tDisplaysRequests.requestClosedReason,
            })
            .orderBy(sortField, params.sort.direction)
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        return {
            rowCount: requests.count,
            rows: requests.data,
        };
    },
});

/**
 * The <DisplaysPage> component hosts a data table that shows the physical displays that have
 * recently checked in, and allows them to be provisioned and configured.
 */
export default async function HelpRequestsPage() {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'organisation.displays',
    });

    const columns: Column<ExtractRowModel<typeof helpRequestsDataSource>>[] = [
        {
            field: 'date',
            headerName: 'Date',
            width: 175,
            template: 'date',
            templateProps: {
                format: 'YYYY-MM-DD HH:mm:ss',
                href: './requests/{id}',
            },
        },
        {
            field: 'display',
            headerName: 'Display',
            flex: 1,
        },
        {
            field: 'event',
            headerName: 'Event',
            flex: 1,
        },
        {
            field: 'target',
            headerName: 'Type',
            width: 110,
            template: 'component',
            templateProps: {
                component: HelpRequestTargetCell,
            },
        },
        {
            field: 'acknowledgedBy',
            headerName: 'Acknowledged',
            flex: 1,
            template: 'text',
            templateProps: {
                defaultValue: 'Pending…',
                href: '/admin/organisation/accounts/{acknowledgedByUserId}',
            },
        },
        {
            field: 'closedBy',
            headerName: 'Closed',
            flex: 1,
            template: 'text',
            templateProps: {
                defaultValue: 'Pending…',
                href: '/admin/organisation/accounts/{closedByUserId}',
            },
        },
        {
            display: 'flex',
            field: 'id',
            headerName: '',
            sortable: false,
            align: 'center',
            width: 50,
            template: 'component',
            templateProps: {
                component: HelpRequestStatusCell,
            },
        },
    ];

    return (
        <DataTable
            columns={columns}
            source={helpRequestsDataSource}
            defaultSort={{ field: 'date', sort: 'desc' }}
            pageSize={25}
            listViewProps={{
                primaryField: 'display',
                secondaryTemplate: 'Request for {target}',
                dateField: 'date',
                dateFieldFormat: 'YYYY-MM-DD HH:mm:ss',
                startComponent: HelpRequestStatusCell,
                linkTemplate: './requests/{id}',
            }}
        />
    );
}

export const generateMetadata = createGenerateMetadataFn('Help Requests', 'Organisation');
