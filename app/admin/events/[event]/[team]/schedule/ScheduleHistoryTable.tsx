// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import type { Column, ExtractContext, ExtractRowModel } from '@app/admin/components/DataTable';
import type { ScheduleHistoryDataSource } from './page';
import { default as DataTableClient } from '@app/admin/components/DataTable/DataTableClient';

/**
 * Props accepted by the <ScheduleHistoryTable> component.
 */
interface ScheduleHistoryTableProps {
    /**
     * Context for which the schedule history should be displayed.
     */
    context: ExtractContext<ScheduleHistoryDataSource>;

    /**
     * Server-side data source through which the schedule history will be acquired.
     */
    source: ScheduleHistoryDataSource;
}

/**
 * The <ScheduleHistoryTable> component displays the most recent changes to the schedule in a table,
 * to provide some insight in which volunteers made which modifications. This is helpful to
 * understand the most recent changes that have been made.
 */
export function ScheduleHistoryTable(props: ScheduleHistoryTableProps) {
    const columns: Column<ExtractRowModel<ScheduleHistoryDataSource>>[] = [
        {
            field: 'user',
            headerName: 'User',
            sortable: false,
            flex: 1,

            template: 'account',
        },
        {
            field: 'date',
            headerName: 'Date',
            sortable: false,
            width: 185,

            template: 'date',
            templateProps: {
                format: 'YYYY-MM-DD HH:mm:ss',
            },
        },
        {
            field: 'mutation',
            headerName: 'Mutation',
            sortable: false,
            flex: 4,
        },
    ];

    return (
        <DataTableClient columns={columns} source={props.source} context={props.context}
                         defaultSort={{ field: 'date', sort: 'desc' }}
                         disableQueryParams disableSearch pageSize={10} subject="log entry"
                         listViewProps={{
                             primaryField: 'mutation',
                             secondaryField: 'user.name',
                             dateField: 'date',
                             dateFieldFormat: 'YYYY-MM-DD HH:mm',
                         }} />
    );
}
