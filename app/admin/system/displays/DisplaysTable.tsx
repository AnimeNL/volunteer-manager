// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Chip from '@mui/material/Chip';
import DeleteIcon from '@mui/icons-material/Delete';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import type { DisplaysRowModel } from '@app/api/admin/displays/[[...id]]/route';
import { RemoteDataTable, type RemoteDataTableColumn } from '@app/admin/components/RemoteDataTable';
import { Temporal, formatDuration } from '@lib/Temporal';

/**
 * Type for the available value options for events.
 */
export type DisplayTableEventOption = { value: number; label: string; };

/**
 * Type for the available value options for locations.
 */
export type DisplayTableLocationOption = { value: number; label: string; eventId: number; };

/**
 * Props accepted by the <DisplaysTable> component.
 */
export interface DisplaysTableProps {
    /**
     * The events with which a display can be associated.
     */
    events: DisplayTableEventOption[];

    /**
     * The locations with which a display can be associated.
     */
    locations: DisplayTableLocationOption[];
}

/**
 * The <DisplaysTable> component displays a data table that allows management of the physical
 * displays we distribute during the festival.
 */
export function DisplaysTable(props: DisplaysTableProps) {
    const { events, locations } = props;

    const currentTime = Temporal.Now.zonedDateTimeISO('utc');
    const columns: RemoteDataTableColumn<DisplaysRowModel>[] = [
        {
            field: 'id',
            headerAlign: 'center',
            headerName: /* no header= */ '',
            editable: false,
            width: 50,

            renderHeader: () =>
                <Tooltip title="Remove the device?">
                    <DeleteIcon fontSize="small" color="primary" />
                </Tooltip>,
        },
        {
            field: 'identifier',
            headerName: 'Identifier',
            editable: false,
            width: 100,

            renderCell: params =>
                <Chip label={params.value} size="small" />,
        },
        {
            field: 'label',
            headerName: 'Label',
            editable: true,
            flex: 1,

            renderCell: params => {
                if (!!params.value)
                    return params.value;

                return (
                    <>
                        <Typography component="span" variant="body2"
                                    sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                            Unprovisioned
                        </Typography>
                        { (!!params.row.eventId || !!params.row.locationId) &&
                            <Tooltip title="The display cannot work without a name">
                                <ErrorOutlineIcon fontSize="small" color="warning" sx={{ ml:.5 }} />
                            </Tooltip> }
                    </>
                );
            },
        },
        {
            field: 'eventId',
            headerName: 'Event',
            editable: true,
            flex: 1,

            type: 'singleSelect',
            valueOptions: [ { value: 0, label: ' ' }, ...events ],

            renderCell: params => {
                if (!!params.value) {
                    for (const { value, label } of events) {
                        if (value === params.value)
                            return label;
                    }
                }

                return (
                    <Typography component="span" variant="body2" sx={{ color: 'text.disabled' }}>
                        …
                    </Typography>
                );
            },
        },
        {
            field: 'locationId',
            headerName: 'Location',
            editable: true,
            flex: 1,

            type: 'singleSelect',
            valueOptions: params => [
                { value: 0, label: ' ' },
                ...locations.filter(location => location.eventId === params.row?.eventId),
            ],

            renderCell: params => {
                if (!!params.value) {
                    for (const { value, label, eventId } of locations) {
                        if (value === params.value && eventId === params.row.eventId)
                            return label;
                    }
                }

                return (
                    <Typography component="span" variant="body2" sx={{ color: 'text.disabled' }}>
                        …
                    </Typography>
                );
            },
        },
        {
            field: 'lastCheckIn',
            headerName: 'Last check-in',
            editable: false,
            flex: 1,

            renderCell: params => {
                const checkIn = Temporal.ZonedDateTime.from(params.value);
                const difference = checkIn.since(currentTime);

                return (
                    <Tooltip title={params.row.lastCheckInIp}>
                        <Typography component="span" variant="body2">
                            { formatDuration(difference) }
                        </Typography>
                    </Tooltip>
                );
            },
        },
        {
            field: 'locked',
            headerAlign: 'center',
            headerName: /* no header= */ '',
            editable: true,
            align: 'center',
            width: 50,

            type: 'boolean',

            renderHeader: () =>
                <Tooltip title="Is the device locked?">
                    <LockIcon fontSize="small" color="primary" />
                </Tooltip>,

            renderCell: params => {
                if (!!params.value) {
                    return (
                        <Tooltip title="Device is locked">
                            <LockIcon fontSize="small" color="success" />
                        </Tooltip>
                    );
                } else {
                    return (
                        <Tooltip title="Device is unlocked">
                            <LockOpenIcon fontSize="small" color="error" />
                        </Tooltip>
                    );
                }
            },
        }
    ];

    return (
        <RemoteDataTable columns={columns} endpoint="/api/admin/displays"
                         defaultSort={{ field: 'id', sort: 'asc' }} subject="display" pageSize={25}
                         enableUpdate enableDelete />
    );
}
