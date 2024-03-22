// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from 'next/link';

import { default as MuiLink } from '@mui/material/Link';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReadMoreIcon from '@mui/icons-material/ReadMore';

import type { OutboxRowModel } from '@app/api/admin/outbox/[[...id]]/route';
import { RemoteDataTable, type RemoteDataTableColumn } from '@app/admin/components/RemoteDataTable';
import { Temporal, formatDate } from '@lib/Temporal';

/**
 * The <OutboxDataTable> component displays all e-mail messages that have been sent by the AnimeCon
 * Volunteer Manager. Each message can be clicked on to see further details and content. Access is
 * restricted to certain volunteers.
 */
export function OutboxDataTable() {
    const localTz = Temporal.Now.timeZoneId();
    const columns: RemoteDataTableColumn<OutboxRowModel>[] = [
        {
            field: 'id',
            display: 'flex',
            headerName: '',
            sortable: false,
            width: 50,

            renderCell: params =>
                <MuiLink component={Link} href={`./outbox/${params.value}`} sx={{ pt: '4px' }}>
                    <ReadMoreIcon color="info" />
                </MuiLink>,
        },
        {
            field: 'date',
            headerName: 'Date',
            width: 150,

            renderCell: params =>
                formatDate(
                    Temporal.ZonedDateTime.from(params.value).withTimeZone(localTz),
                    'YYYY-MM-DD HH:mm:ss'),
        },
        {
            field: 'from',
            headerName: 'Sender',
            sortable: true,
            flex: 2,

            renderCell: params => {
                if (!params.row.fromUserId)
                    return params.value;

                return (
                    <MuiLink component={Link} href={`/admin/volunteers/${params.row.fromUserId}`}>
                        {params.value}
                    </MuiLink>
                );
            },
        },
        {
            field: 'to',
            headerName: 'Recipient',
            sortable: true,
            flex: 2,

            renderCell: params => {
                if (!params.row.fromUserId)
                    return params.value;

                return (
                    <MuiLink component={Link} href={`/admin/volunteers/${params.row.fromUserId}`}>
                        {params.value}
                    </MuiLink>
                );
            },
        },
        {
            field: 'subject',
            headerName: 'Subject',
            sortable: true,
            flex: 3,

            renderCell: params =>
                <MuiLink component={Link} href={`./outbox/${params.row.id}`}>
                    {params.value}
                </MuiLink>,
        },
        {
            field: 'delivered',
            display: 'flex',
            headerName: 'Accepted',
            headerAlign: 'center',
            align: 'center',
            description: 'Whether the e-mail was accepted by the server',
            sortable: true,
            width: 100,

            renderCell: params =>
                params.value ? <CheckCircleIcon fontSize="small" color="success" />
                             : <CancelIcon fontSize="small" color="error" />,
        },
    ];

    return <RemoteDataTable columns={columns} endpoint="/api/admin/outbox"
                            defaultSort={{ field: 'date', sort: 'desc' }} pageSize={50} />;
}
