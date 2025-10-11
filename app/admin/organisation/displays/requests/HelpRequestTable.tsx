// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Chip from '@mui/material/Chip';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import type { DisplayRequestRowModel } from '@app/api/admin/organisation/displays/requests/route';
import { RemoteDataTable, type RemoteDataTableColumn } from '@app/admin/components/RemoteDataTable';
import { Temporal, formatDate } from '@lib/Temporal';

import { kHelpRequestColours } from './HelpRequestColours';

/**
 * The <HelpRequestTable> component displays a data table that shows the help requests that have
 * been issued through each particular display, including state and logged reason.
 */
export function HelpRequestTable() {
    const localTz = Temporal.Now.timeZoneId();
    const columns: RemoteDataTableColumn<DisplayRequestRowModel>[] = [
        {
            field: 'date',
            headerName: 'Date',
            sortable: true,
            width: 175,

            renderCell: params => {
                const label = formatDate(
                    Temporal.ZonedDateTime.from(params.value).withTimeZone(localTz),
                    'YYYY-MM-DD HH:mm:ss');

                return (
                    <MuiLink component={Link} href={`./requests/${params.row.id}`}>
                        {label}
                    </MuiLink>
                );
            },
        },
        {
            field: 'display',
            headerName: 'Display',
            sortable: true,
            flex: 1,
        },
        {
            field: 'event',
            headerName: 'Event',
            sortable: true,
            flex: 1,
        },
        {
            field: 'target',
            headerName: 'Type',
            sortable: true,
            width: 110,

            renderCell: params => {
                const [ foreground, background ] = kHelpRequestColours[params.row.target];
                return (
                    <Chip label={params.value} size="small"
                          sx={{ backgroundColor: background, color: foreground }} />
                );
            },
        },
        {
            field: 'acknowledgedBy',
            headerName: 'Acknowledged',
            flex: 1,

            renderCell: params => {
                if (!params.value || !params.row.acknowledgedDate) {
                    return (
                        <Typography component="span" variant="body2"
                                    sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                            Pending…
                        </Typography>
                    );
                }

                const title = formatDate(
                    Temporal.ZonedDateTime.from(params.row.acknowledgedDate).withTimeZone(localTz),
                    'YYYY-MM-DD HH:mm:ss');

                const href = `/admin/organisation/accounts/${params.row.acknowledgedByUserId}`;
                return (
                    <Tooltip title={title}>
                        <MuiLink component={Link} href={href}>
                            {params.row.acknowledgedBy}
                        </MuiLink>
                    </Tooltip>
                );
            },
        },
        {
            field: 'closedBy',
            headerName: 'Closed',
            flex: 1,

            renderCell: params => {
                if (!params.value || !params.row.closedDate) {
                    return (
                        <Typography component="span" variant="body2"
                                    sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                            Pending…
                        </Typography>
                    );
                }

                const title = formatDate(
                    Temporal.ZonedDateTime.from(params.row.closedDate).withTimeZone(localTz),
                    'YYYY-MM-DD HH:mm:ss');

                const href = `/admin/organisation/accounts/${params.row.closedByUserId}`;
                return (
                    <Tooltip title={title}>
                        <MuiLink component={Link} href={href}>
                            {params.row.closedBy}
                        </MuiLink>
                    </Tooltip>
                );
            },
        },
        {
            display: 'flex',
            field: 'id',
            headerName: /* empty= */ '',
            sortable: false,
            align: 'center',
            width: 50,

            renderCell: params => {
                if (!!params.row.closedBy) {
                    return (
                        <Tooltip title="Request has been fulfilled">
                            <CheckCircleIcon fontSize="small" color="success" />
                        </Tooltip>
                    );
                } else if (!!params.row.acknowledgedBy) {
                    return (
                        <Tooltip title="Request has been acknowledged">
                            <ErrorOutlineIcon fontSize="small" color="warning" />
                        </Tooltip>
                    );
                } else {
                    return (
                        <Tooltip title="Request is still pending">
                            <CancelIcon fontSize="small" color="error" />
                        </Tooltip>
                    );
                }
            },
        },
    ];

    return (
        <RemoteDataTable columns={columns} endpoint="/api/admin/organisation/displays/requests"
                         defaultSort={{ field: 'date', sort: 'desc' }} pageSize={25} />
    );
}
