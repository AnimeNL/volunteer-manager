// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ReadMoreIcon from '@mui/icons-material/ReadMore';
import WarningOutlinedIcon from '@mui/icons-material/WarningOutlined';

import type { LogsRowModel } from '@app/api/admin/logs/[[...id]]/route';
import { RemoteDataTable, type RemoteDataTableColumn } from '@app/admin/components/RemoteDataTable';
import { Temporal, formatDate } from '@lib/Temporal';

/**
 * Props made available to the <LogsDataTable> component.
 */
interface LogsDataTableProps {
    /**
     * Whether the ability to delete log entries should be shown in the user interface.
     */
    enableDelete?: boolean;

    /**
     * Filters to apply to the logs selection. Filters are optional, and will be communicated with
     * the server where the actual filtering will take place.
     */
    filters?: {
        sourceOrTargetUserId?: number;
    };

    /**
     * Optional setting for the number of items that should be shown per page.
     */
    pageSize?: 10 | 25 | 50 | 100;
}

/**
 * The <LogsDataTable> component populates the client-side table with the necessary functions to
 * transform the data and add interaction where applicable.
 */
export function LogsDataTable(props: LogsDataTableProps) {
    const { enableDelete, filters, pageSize } = props;

    const localTz = Temporal.Now.timeZoneId();

    const context = { v: '1', userId: filters?.sourceOrTargetUserId } as const;
    const columns: RemoteDataTableColumn<LogsRowModel>[] = [
        {
            field: 'date',
            headerName: 'Date',
            flex: 1,

            renderCell: params =>
                formatDate(
                    Temporal.ZonedDateTime.from(params.value).withTimeZone(localTz),
                    'YYYY-MM-DD HH:mm:ss'),
        },
        {
            field: 'severity',
            display: 'flex',
            headerName: '',
            align: 'center',
            width: 50,

            renderCell: params => {
                switch (params.value) {
                    case 'Debug':
                        return <CircleOutlinedIcon color="action" />;
                    case 'Info':
                        return <InfoOutlinedIcon color="info" />;
                    case 'Warning':
                        return <WarningOutlinedIcon color="warning" />;
                    case 'Error':
                        return <ErrorOutlinedIcon color="error" />;
                }

                return params.value;
            },
        },
        {
            display: 'flex',
            field: 'message',
            headerName: 'Message',
            sortable: false,
            flex: 3,

            renderCell: params => {
                if (params.row.type !== 'database-error')
                    return params.value;

                const href = `/admin/system/diagnostics/logs/database-error/${params.row.id}`;

                return (
                    <>
                        {params.value}
                        <MuiLink sx={{ mt: 0.5, ml: 1 }} component={Link} href={href}>
                            <ReadMoreIcon color="info" fontSize="small" />
                        </MuiLink>
                    </>
                );
            },
        },
        {
            field: 'source',
            headerName: 'Source user',
            flex: 1,

            renderCell: params => {
                if (!params.value)
                    return undefined;

                return (
                    <MuiLink component={Link}
                             href={`/admin/organisation/accounts/${params.value.userId}`}>
                        {params.value.name}
                    </MuiLink>
                );
            },
        },
        {
            field: 'target',
            headerName: 'Target user',
            flex: 1,

            renderCell: params => {
                if (!params.value)
                    return undefined;

                return (
                    <MuiLink component={Link}
                             href={`/admin/organisation/accounts/${params.value.userId}`}>
                        {params.value.name}
                    </MuiLink>
                );
            },
        },
    ];

    if (enableDelete) {
        columns.unshift({
            field: 'id',
            headerName: '',
            editable: false,
            sortable: false,
            width: 50,
        });
    }

    return <RemoteDataTable columns={columns} endpoint="/api/admin/logs" context={context}
                            defaultSort={{ field: 'date', sort: 'desc' }}
                            enableDelete={enableDelete} enableQueryParams subject="log entry"
                            pageSize={ pageSize ?? 50 } />;
}
