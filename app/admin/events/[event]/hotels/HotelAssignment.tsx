// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from 'next/link';
import React, { useCallback, useLayoutEffect, useRef } from 'react';

import type { GridRenderEditCellParams } from '@mui/x-data-grid-pro';
import { default as MuiLink } from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Collapse from '@mui/material/Collapse';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useGridApiContext } from '@mui/x-data-grid-pro';

import type { HotelsAssignmentsRowModel } from '@app/api/admin/hotels/assignments/[[...id]]/route';
import type { PageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';
import { RemoteDataTable, type RemoteDataTableColumn } from '@app/admin/components/RemoteDataTable';

/**
 * Props accepted by the <HotelAssignmentPersonSelect> component.
 */
interface HotelAssignmentPersonSelectProps extends GridRenderEditCellParams {
    /**
     * Names of the volunteers who have requested a hotel room.
     */
    requests: string[];
}

/**
 * The <HotelAssignmentPersonSelect> component displays a select box in which an individual can be
 * typed who will stay in said hotel room. Volunteers who are pending assignment will be suggested.
 */
function HotelAssignmentPersonSelect(props: HotelAssignmentPersonSelectProps) {
    const { field, hasFocus, id } = props;

    const context = useGridApiContext();
    if (context.current === null)
        throw new Error('The Grid API context is not available');

    const handleAutocompleteChange = useCallback((event: unknown, value: string) => {
        context.current!.setEditCellValue({ id, field, value });
    }, [ context, field, id ]);

    const handleInputChange = useCallback(
        (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
            context.current!.setEditCellValue({ id, field, value: event.currentTarget.value });
        }, [ context, field, id ]);

    const ref = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

    useLayoutEffect(() => {
        if (hasFocus && ref.current)
            ref.current.focus();

    }, [ hasFocus ]);

    return (
        <Autocomplete freeSolo disableClearable fullWidth options={props.requests}
                      value={props.value} onChange={handleAutocompleteChange}
                      renderOption={ (params, option) =>
                          <li {...params} key={option}>{option}</li> }
                      renderInput={ (params) =>
                          <TextField {...params} fullWidth size="small" inputRef={ref}
                                     onChange={handleInputChange} /> } />
    );
}

/**
 * Renders a possibly linkified occupant in one of the assignment table cells.
 */
function RenderLinkifiedOccupant(
    event: PageInfo['event'], name?: string, userId?: number, team?: string)
{
    if (!name)
        return undefined;  // this occupant does not exist

    if (!userId || !team)
        return name;  // this occupant is not a volunteer

    const href = `/admin/events/${event.slug}/${team}/volunteers/${userId}`;
    return (
        <MuiLink component={Link} href={href}>
            {name}
        </MuiLink>
    );
}

/**
 * Returns a stringified, ISO representation of the given `input`.
 */
function toDateString(input: Date): string {
    const month = `0${input.getMonth() + 1}`.substr(-2);
    const date = `0${input.getDate()}`.substr(-2);

    return `${input.getFullYear()}-${month}-${date}`;
}

/**
 * Props accepted by the <HotelAssignment> component.
 */
interface HotelAssignmentProps {
    /**
     * Information about the event for which hotel rooms are being shown.
     */
    event: PageInfo['event'];

    /**
     * Names of the volunteers who have requested a hotel room.
     */
    requests: string[];

    /**
     * The hotel rooms that volunteers can be assigned too. Includes removed rooms.
     */
    rooms: { value: number, label: string }[];

    /**
     * Warnings that should be displayed under the assignments table.
     */
    warnings: { volunteer: string, warning: string }[];
}

/**
 * The <HotelAssignment> component displays the hotel rooms that have been compiled based on the
 * preferences expressed by the volunteers. This UI currently supports up to three occupants.
 */
export function HotelAssignment(props: HotelAssignmentProps) {
    const { event, requests, warnings } = props;

    const context = { event: event.slug };
    const columns: RemoteDataTableColumn<HotelsAssignmentsRowModel>[] = [
        {
            field: 'id',
            headerName: /* empty= */ '',
            sortable: false,
            width: 50,
        },
        {
            field: 'firstName',
            headerName: 'Booking owner',
            sortable: false,
            editable: true,
            flex: 1,

            renderCell: params => RenderLinkifiedOccupant(
                event, params.row.firstName, params.row.firstUserId, params.row.firstTeam),

            renderEditCell: params =>
                <HotelAssignmentPersonSelect requests={requests} {...params} />,
        },
        {
            field: 'secondName',
            headerName: 'Second guest',
            sortable: false,
            editable: true,
            flex: 1,

            renderCell: params => RenderLinkifiedOccupant(
                event, params.row.secondName, params.row.secondUserId, params.row.secondTeam),

            renderEditCell: params =>
                <HotelAssignmentPersonSelect requests={requests} {...params} />,
        },
        {
            field: 'thirdName',
            headerName: 'Third guest',
            sortable: false,
            editable: true,
            flex: 1,

            renderCell: params => RenderLinkifiedOccupant(
                event, params.row.thirdName, params.row.thirdUserId, params.row.thirdTeam),

            renderEditCell: params =>
                <HotelAssignmentPersonSelect requests={requests} {...params} />,
        },
        {
            field: 'hotelId',
            headerName: 'Hotel room',
            sortable: false,
            editable: true,
            flex: 1,

            type: 'singleSelect',
            valueOptions: props.rooms,
        },
        {
            field: 'checkIn',
            headerName: 'Check in',
            sortable: false,
            editable: true,
            width: 110,

            type: 'date',
            valueGetter: (value, row) => new Date(row.checkIn),
            valueSetter: (value, row) => ({
                ...row,
                checkIn: toDateString(value),
            }),

            renderCell: params => params.row.checkIn,
        },
        {
            field: 'checkOut',
            headerName: 'Check out',
            sortable: false,
            editable: true,
            width: 110,

            type: 'date',
            valueGetter: (value, row) => new Date(row.checkOut),
            valueSetter: (value, row) => ({
                ...row,
                checkOut: toDateString(value),
            }),

            renderCell: params => params.row.checkOut,
        },
        {
            field: 'confirmed',
            headerName: 'Booked',
            editable: true,
            sortable: false,
            width: 100,
            type: 'boolean',

            renderCell: params => {
                return !!params.value ? <CheckCircleIcon fontSize="small" color="success" />
                                      : <CancelIcon fontSize="small" color="error" />;
            },
        }
    ];

    return (
        <Paper sx={{ p: 2 }}>
            <Typography variant="h5" sx={{ pb: 1 }}>
                Hotel rooms
                <Typography component="span" variant="h5" color="action.active" sx={{ pl: 1 }}>
                    ({event.shortName})
                </Typography>
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
                The following list describes our hotel rooms for <strong>{event.shortName}</strong>.
                Check the "booked" column when the room has been requested using the official{' '}
                { event.hotelRoomForm
                    ? <MuiLink component={Link} href={event.hotelRoomForm}>hotel room form</MuiLink>
                    : 'hotel room form' }
                , after which we consider the booking as confirmed.
            </Alert>
            <RemoteDataTable endpoint="/api/admin/hotels/assignments" context={context}
                             columns={columns} defaultSort={{ field: 'firstName', sort: 'asc' }}
                             disableFooter enableCreate enableDelete enableUpdate
                             refreshOnUpdate subject="assignment" />
            <Collapse in={warnings.length > 0}>
                <Alert severity="warning" sx={{ mt: 2 }}>
                    <Stack direction="column" spacing={0} sx={{ maxWidth: '100%' }}>
                        { warnings.map(({ volunteer, warning }, index) =>
                            <Typography key={index} variant="body2">
                                <strong>{volunteer}</strong> {warning}
                            </Typography> )}
                    </Stack>
                </Alert>
            </Collapse>
        </Paper>
    );
}
