// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';
import ShareIcon from '@mui/icons-material/Share';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import type { ExportsRowModel } from '@app/api/admin/exports/[[...id]]/route';
import { RemoteDataTable, type RemoteDataTableColumn } from '@app/admin/components/RemoteDataTable';
import { Temporal, formatDate, formatDuration } from '@lib/Temporal';

/**
 * The <ExportsDataTable> component lists all exports, both active and past. Entries may be deleted
 * (which will deactivate them), whereas each entry links through to a details page.
 */
export function ExportsDataTable() {
    const now = Temporal.Now.zonedDateTimeISO('UTC');

    const columns: RemoteDataTableColumn<ExportsRowModel>[] = [
        {
            display: 'flex',
            field: 'id',
            headerName: /* empty= */ '',
            align: 'center',
            sortable: false,
            width: 50,

            renderCell: params =>
                <>
                    { !!params.row.enabled &&
                        <Tooltip title="The exported data is available">
                            <ShareIcon color="warning" fontSize="small" />
                        </Tooltip> }
                    { !params.row.enabled &&
                        <Tooltip title="The exported data no longer is available">
                            <ShareIcon color="disabled" fontSize="small" />
                        </Tooltip> }
                </>,
        },
        {
            field: 'event',
            headerName: 'Exported data',
            sortable: true,
            flex: 2,

            renderCell: params =>
                <MuiLink component={Link} href={`./exports/${params.row.id}`}>
                    {params.value} {params.row.type}{' '}
                    ({params.row.justification})
                </MuiLink>,
        },
        {
            field: 'createdBy',
            headerName: 'Responsible',
            sortable: true,
            flex: 1,

            renderCell: params =>
                <MuiLink component={Link} href={`./accounts/${params.row.createdByUserId}`}>
                    {params.value}
                </MuiLink>
        },
        {
            field: 'expirationDate',
            headerName: 'Expiration time',
            sortable: true,
            flex: 1,

            renderCell: params => {
                const value = Temporal.ZonedDateTime.from(params.value);
                if (Temporal.ZonedDateTime.compare(now, value) >= 0 || !params.row.enabled) {
                    return (
                        <Typography component="span" variant="body2"
                                    sx={{ color: 'text.disabled' }}>
                            expired
                        </Typography>
                    );
                } else {
                    return (
                        <Tooltip title={formatDate(value, 'dddd, MMMM Do [at] HH:mm:ss')}>
                            <Typography component="span" variant="body2">
                                { formatDuration(now.until(value)) }
                            </Typography>
                        </Tooltip>
                    );
                }
            },
        },
        {
            field: 'expirationViews',
            headerName: 'Access limits',
            sortable: true,
            flex: 1,

            renderCell: params =>
                <Typography component="span" variant="body2">
                    {params.row.views}{' '}
                    <Typography component="span" variant="body2" sx={{ color: 'text.disabled' }}>
                        / {params.value}
                    </Typography>
                </Typography>
        }
    ];

    return (
        <RemoteDataTable columns={columns} endpoint="/api/admin/exports"
                         enableQueryParams defaultSort={{ field: 'createdOn', sort: 'desc' }}
                         pageSize={25} />
    );
}
