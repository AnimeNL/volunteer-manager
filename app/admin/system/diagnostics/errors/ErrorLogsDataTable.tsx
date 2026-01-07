// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';
import Chip from '@mui/material/Chip';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Typography from '@mui/material/Typography';
import WarningOutlinedIcon from '@mui/icons-material/WarningOutlined';

import type { ErrorLogsRowModel } from '@app/api/admin/system/diagnostics/errors/[[...id]]/route';
import { RemoteDataTable, type RemoteDataTableColumn } from '@app/admin/components/RemoteDataTable';
import { Temporal, formatDate } from '@lib/Temporal';
import { kErrorSource } from '@lib/database/Types';

/**
 * The <ErrorLogsDataTable> component populates the client-side table with the errors that occurred
 * on the Volunteer Manager in recent history.
 */
export function ErrorLogsDataTable(props: { includeLocalColumn?: boolean }) {
    const localTz = Temporal.Now.timeZoneId();

    const columns: RemoteDataTableColumn<ErrorLogsRowModel>[] = [
        {
            field: 'date',
            headerName: 'Date',
            width: 175,

            renderCell: params => {
                return (
                    <MuiLink component={Link} href={`./errors/${params.row.id}`}>
                        {formatDate(
                            Temporal.ZonedDateTime.from(params.value).withTimeZone(localTz),
                            'YYYY-MM-DD HH:mm:ss')}
                    </MuiLink>
                );
            },

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
            field: 'source',
            headerAlign: 'center',
            headerName: 'Issue type',
            sortable: true,
            width: 100,
            align: 'center',

            renderCell: params => {
                switch (params.value) {
                    case kErrorSource.Client:
                        return <Chip color="primary" label="Client" size="small" />;
                    case kErrorSource.Server:
                        return <Chip color="info" label="Server" size="small" />;
                }
            },
        },
        {
            display: 'flex',
            field: 'message',
            headerName: 'Message',
            sortable: false,
            flex: 3,

            renderCell: params => {
                return (
                    <MuiLink component={Link} href={`./errors/${params.row.id}`}>
                        {params.value}
                    </MuiLink>
                );
            },
        },
        {
            display: 'flex',
            field: 'user',
            headerName: 'Account',
            sortable: true,
            flex: 1,

            renderCell: params => {
                if (!params.value) {
                    return (
                        <Typography variant="inherit" sx={{ color: 'text.disabled' }}>
                            Anonymous
                        </Typography>
                    );
                }

                return (
                    <MuiLink component={Link}
                             href={`/admin/organisation/accounts/${params.row.userId}`}>
                        {params.value}
                    </MuiLink>
                );
            },
        },
    ];

    // Add an additional column on local builds that flags errors which are local. These are hidden
    // on production builds as they just cause noise, without any additional information.
    if (props.includeLocalColumn) {
        columns.push({
            display: 'flex',
            field: 'isLocal',
            headerName: '',
            sortable: false,
            width: 80,
            align: 'center',

            renderCell: params => {
                if (!params.value)
                    return null;

                return <Chip color="info" label="dev" size="small" />;
            },
        });
    }

    return <RemoteDataTable columns={columns} endpoint="/api/admin/system/diagnostics/errors"
                            defaultSort={{ field: 'date', sort: 'desc' }} enableQueryParams />;
}
