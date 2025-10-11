// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Paper from '@mui/material/Paper';

import type { RefundRequestRowModel } from '@app/api/admin/refunds/[[...id]]/route';
import { RemoteDataTable, type RemoteDataTableColumn } from '@app/admin/components/RemoteDataTable';
import { Temporal, formatDate } from '@lib/Temporal';

/**
 * Props accepted by the <RefundsTable> component.
 */
interface RefundsTableProps {
    /**
     * Unique slug of the event refund request should be considered for.
     */
    event: string;
}

/**
 * The <RefundsTable> component displays the volunteers that have so far requested a refund.
 */
export function RefundsTable(props: RefundsTableProps) {
    const { event } = props;

    const columns: RemoteDataTableColumn<RefundRequestRowModel>[] = [
        {
            field: 'name',
            headerName: 'Volunteer',
            sortable: false,
            editable: false,
            flex: 1,

            renderCell: params =>
                <MuiLink component={Link} href={`./${params.row.team}/volunteers/${params.row.id}`}>
                    {params.value}
                </MuiLink>
        },
        {
            field: 'ticketNumber',
            headerName: 'Ticket',
            sortable: false,
            editable: false,
            flex: 1,
        },
        {
            field: 'accountIban',
            headerName: 'Account (IBAN)',
            sortable: false,
            editable: false,
            flex: 1,
        },
        {
            field: 'accountName',
            headerName: 'Account (name)',
            sortable: false,
            editable: false,
            flex: 1,
        },
        {
            field: 'requested',
            headerName: 'Requested',
            sortable: false,
            editable: false,
            width: 100,

            renderCell: params =>
                formatDate(Temporal.ZonedDateTime.from(params.value), 'YYYY-MM-DD'),
        },
        {
            field: 'confirmed',
            headerName: 'Confirmed',
            headerAlign: 'center',
            align: 'center',
            sortable: false,
            editable: true,
            type: 'boolean',
            width: 100,

            renderCell: params => {
                return !!params.value ? <CheckCircleIcon fontSize="small" color="success" />
                                      : <CancelIcon fontSize="small" color="error" />;
            },
        }
    ];

    return (
        <Paper sx={{ p: 2 }}>
            <RemoteDataTable columns={columns} endpoint="/api/admin/refunds" enableUpdate
                             context={{ event }} defaultSort={{ field: 'id', sort: 'asc' }}
                             disableFooter pageSize={100} />
        </Paper>
    );
}
