// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Column } from '@app/admin/components/DataTable';
import { DataTable } from '@app/admin/components/DataTable';
import { logsDataSource, type LogsRowModel } from './LogsDataSource';

/**
 * Props made available to the <LogsDataTable> component.
 */
interface LogsDataTableProps {
    /**
     * Optional setting for the number of items that should be shown per page.
     */
    pageSize?: 10 | 25 | 50 | 100;

    /**
     * User ID for the account for whom the log entries should be filtered.
     */
    userId?: number;
}

/**
 * The <LogsDataTable> component populates the client-side table with the necessary functions to
 * transform the data and add interaction where applicable.
 */
export function LogsDataTable(props: LogsDataTableProps) {
    const columns: Column<LogsRowModel>[] = [
        {
            field: 'date',
            headerName: 'Date',
            width: 185,

            template: 'date',
            templateProps: {
                format: 'YYYY-MM-DD HH:mm:ss',
            },
        },
        {
            field: 'severity',
            headerName: '',
            align: 'center',
            width: 50,

            template: 'severity',
        },
        {
            field: 'message',
            headerName: 'Message',
            sortable: false,

            flex: 3,
        },
        {
            field: 'initiatorUser',
            headerName: 'Initiator',
            flex: 1,

            template: 'account',
            templateProps: {
                noAccountLabel: 'Anonymous',
            },
        },
        {
            field: 'affectedUser',
            headerName: 'Affected',
            flex: 1,

            template: 'account',
            templateProps: {
                noAccountLabel: 'Anonymous',
            },
        },
    ];

    return (
        <DataTable
            columns={columns}
            source={logsDataSource}
            context={{ userId: props.userId }}
            defaultSort={{ field: 'date', sort: 'desc' }}
            subject="log entry"
            pageSize={props.pageSize}
            listViewProps={{
                primaryField: 'message',
                secondaryField: 'initiatorUser.name',
                dateField: 'date',
                dateFieldFormat: 'YYYY-MM-DD',
            }}
        />
    );
}
