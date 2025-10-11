// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';
import Chip from '@mui/material/Chip';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import ReadMoreIcon from '@mui/icons-material/ReadMore';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import Tooltip from '@mui/material/Tooltip';
import VerifiedIcon from '@mui/icons-material/Verified';

import type { WebhookRowModel } from '@app/api/admin/webhooks/route';
import { RemoteDataTable, type RemoteDataTableColumn } from '@app/admin/components/RemoteDataTable';
import { Temporal, formatDate } from '@lib/Temporal';

/**
 * Colours assigned to chips for particular services.
 */
const kServiceColours = {
    twilio: [ '#ffffff', '#f22f46' ],
};

/**
 * Size units used to display the size of a received message.
 */
const kMessageSizeUnit = [ 'bytes', 'KiB', 'MiB', 'GiB' ];

/**
 * Props accepted by the <WebhookDataTable> component.
 */
interface WebhookDataTableProps {
    /**
     * Filter for Twilio webhooks to filter by a particular message SID.
     */
    twilioMessageSid?: string;
}

/**
 * The <WebhookDataTable> component displays all webhook calls received by the Volunteer Manager.
 * Each links through to a detailed page with all information regarding that particular webhook.
 */
export function WebhookDataTable(props: WebhookDataTableProps) {
    const localTz = Temporal.Now.timeZoneId();
    const columns: RemoteDataTableColumn<WebhookRowModel>[] = [
        {
            field: 'id',
            display: 'flex',
            headerName: '',
            sortable: false,
            width: 50,

            renderCell: params => {
                const href = `/admin/system/webhooks/${params.row.service}/${params.id}`;
                return (
                    <MuiLink component={Link} href={href} sx={{ pt: '5px' }}>
                        <ReadMoreIcon color="info" />
                    </MuiLink>
                );
            },
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
            field: 'service',
            headerName: 'Service',
            sortable: true,
            width: 125,

            renderCell: params => {
                if (!kServiceColours.hasOwnProperty(params.value))
                    return <Chip label={params.value} size="small" />;

                const [ color, backgroundColor ] =
                    kServiceColours[params.value as keyof typeof kServiceColours];

                const label =
                    (params.value && params.value[0].toUpperCase() + params.value.slice(1)) || '';

                return <Chip label={label} size="small" sx={{ backgroundColor, color }} />;
            },
        },
        {
            field: 'type',
            headerName: 'Type',
            sortable: true,
            width: 125,

            renderCell: params =>
                <Chip label={params.value} size="small" />,
        },
        {
            field: 'source',
            headerName: 'Received from',
            sortable: true,
            flex: 2,
        },
        {
            field: 'destination',
            headerName: 'Destination',
            sortable: true,
            flex: 3,

            renderCell: params => params.value && new URL(params.value).pathname,
        },
        {
            field: 'size',
            headerName: 'Size',
            sortable: true,
            flex: 1,

            renderCell: params => {
                let size = parseInt(params.value, 10);
                let unitIndex = 0;

                while (size >= 1024) {
                    size /= 1024;
                    unitIndex++;
                }

                return `${Math.round(size * 100) / 100} ${ kMessageSizeUnit[unitIndex] ?? 'TiB' }`;
            },
        },
        {
            display: 'flex',
            field: 'authenticated',
            headerName: /* empty= */ '',
            sortable: false,
            width: 50,

            renderHeader: () =>
                <Tooltip title="Could the call be authenticated?">
                    <VerifiedIcon color="primary" fontSize="small" />
                </Tooltip>,

            renderCell: params => {
                if (!!params.value) {
                    return (
                        <Tooltip title="Authentication was successful">
                            <TaskAltIcon color="success" fontSize="small" />
                        </Tooltip>
                    );
                } else if (params.value === null || params.value === undefined) {
                    return (
                        <Tooltip title="No authentication was attempted">
                            <RadioButtonUncheckedIcon color="disabled" fontSize="small" />
                        </Tooltip>
                    );
                } else {
                    return (
                        <Tooltip title="The call coult not be authenticated">
                            <ErrorOutlineIcon color="error" fontSize="small" />
                        </Tooltip>
                    );
                }
            },
        },
    ];

    return <RemoteDataTable columns={columns} endpoint="/api/admin/webhooks"
                            context={{ foo: 'bar', ...props }} enableQueryParams
                            defaultSort={{ field: 'id', sort: 'desc' }} pageSize={50} />;
}
