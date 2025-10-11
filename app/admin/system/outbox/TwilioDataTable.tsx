// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReadMoreIcon from '@mui/icons-material/ReadMore';
import Typography from '@mui/material/Typography';

import type { OutboxTwilioRowModel } from '@app/api/admin/outbox/twilio/route';
import type { TwilioOutboxType } from '@lib/database/Types';
import { RemoteDataTable, type RemoteDataTableColumn } from '@app/admin/components/RemoteDataTable';
import { Temporal, formatDate } from '@lib/Temporal';

/**
 * Props accepted by the <TwilioDataTable> component.
 */
interface TwilioDataTableProps {
    /**
     * Type of messages that the data table should consider.
     */
    type: TwilioOutboxType;
}

/**
 * The <TwilioDataTable> component displays
 */
export function TwilioDataTable(props: TwilioDataTableProps) {
    const localTz = Temporal.Now.timeZoneId();
    const type = props.type.toLowerCase();

    const columns: RemoteDataTableColumn<OutboxTwilioRowModel>[] = [
        {
            field: 'id',
            display: 'flex',
            headerName: '',
            sortable: false,
            width: 50,

            renderCell: params =>
                <MuiLink component={Link} href={`./${type}/${params.value}`} sx={{ pt: '4px' }}>
                    <ReadMoreIcon color="info" />
                </MuiLink>,
        },
        {
            field: 'date',
            headerName: 'Date',
            width: 175,

            renderCell: params =>
                formatDate(
                    Temporal.ZonedDateTime.from(params.value).withTimeZone(localTz),
                    'YYYY-MM-DD HH:mm:ss'),
        },
        {
            field: 'sender',
            headerName: 'Sender',
            sortable: true,
            flex: 2,

            renderCell: params => {
                if (!params.value || !params.value.name) {
                    return (
                        <Typography component="span" variant="body2"
                                    sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                            Unknown…
                        </Typography>
                    );
                }

                const { name, userId } = params.value;
                if (!userId)
                    return name;

                return (
                    <MuiLink component={Link} href={`/admin/organisation/accounts/${userId}`}>
                        {name}
                    </MuiLink>
                );
            },
        },
        {
            field: 'recipient',
            headerName: 'Recipient',
            sortable: true,
            flex: 2,

            renderCell: params => {
                const { name, userId } = params.row.recipient;
                return (
                    <MuiLink component={Link} href={`/admin/organisation/accounts/${userId}`}>
                        {name}
                    </MuiLink>
                );
            },
        },
        {
            field: 'message',
            headerName: 'Message',
            sortable: true,
            flex: 3,

            renderCell: params =>
                <MuiLink component={Link} href={`./${type}/${params.row.id}`}>
                    {params.value}
                </MuiLink>,
        },
        {
            field: 'delivered',
            display: 'flex',
            headerName: 'Delivered',
            headerAlign: 'center',
            align: 'center',
            description: 'Whether the message was successfully delivered',
            sortable: true,
            width: 100,

            renderCell: params =>
                params.value ? <CheckCircleIcon fontSize="small" color="success" />
                             : <CancelIcon fontSize="small" color="error" />,
        },
    ];

    return <RemoteDataTable columns={columns} endpoint="/api/admin/outbox/twilio"
                            context={{ type: props.type }} enableQueryParams
                            defaultSort={{ field: 'date', sort: 'desc' }} pageSize={50} />;
}
