// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';
import Typography from '@mui/material/Typography';

import { DataTable, type DataTableColumn } from '@app/admin/components/DataTable';
import { Temporal, formatDate } from '@lib/Temporal';

/**
 * Props accepted by the <AccessLogsDataTable> component.
 */
interface AccessLogsDataTableProps {
    /**
     * Views that were logged for this resource in the database.
     */
    views: {
        id: number,
        date: string,
        userIp: string,
        userAgent: string,
        userId?: number,
        userName?: string,
    }[];
}

/**
 * The <AccessLogsDataTable> component displays a simple data table listing each of the times access
 * was obtained to a particular resource.
 */
export function AccessLogsDataTable(props: AccessLogsDataTableProps) {
    const localTz = Temporal.Now.timeZoneId();

    const columns: DataTableColumn<AccessLogsDataTableProps['views'][number]>[] = [
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
            field: 'userIp',
            headerName: 'IP Address',
            flex: 1,
        },
        {
            field: 'userAgent',
            headerName: 'User Agent',
            flex: 2,
        },
        {
            display: 'flex',
            field: 'userName',
            headerName: 'Volunteer',
            flex: 1,

            renderCell: params => {
                if (!!params.value) {
                    return (
                        <MuiLink component={Link} href={`../${params.row.userId}`}>
                            {params.value}
                        </MuiLink>
                    );
                } else {
                    return (
                        <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                            unknown
                        </Typography>
                    );
                }
            },
        }
    ];

    return (
        <DataTable columns={columns} rows={props.views} pageSize={100} disableFooter
                   defaultSort={{ field: 'date', sort: 'desc' }} />
    );
}
