// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

import { DataTable, type DataTableColumn } from '@app/admin/components/DataTable';

/**
 * Row model for a pending hotel request.
 */
export interface HotelPendingRequestRowModel {
    /**
     * Unique ID of the user who would like to request a hotel room.
     */
    id: number;

    /**
     * Name of the user who would like to request a hotel room.
     */
    name: string;

    /**
     * URL-safe slug identifing the URL the volunteer is part of.
     */
    team: string;

    /**
     * Name of the hotel in which they would like to book a room.
     */
    hotel: string;

    /**
     * Dates (YYYY-MM-DD) on which the volunteer would like to check in, and out.
     */
    checkIn: string;
    checkOut: string;

    /**
     * Date (YYYY-MM-DD) on which the volunteer requested the hotel room.
     */
    requested: string;
}

/**
 * Props accepted by the <HotelPendingAssignment> component.
 */
interface HotelPendingAssignmentProps {
    /**
     * The requests that have not been assigned to any rooms yet.
     */
    requests: HotelPendingRequestRowModel[];
}

/**
 * The <HotelPendingAssignment> component displays the volunteers who have expressed interest in
 * having a hotel room booking, but have not been assigned a room just yet.
 */
export function HotelPendingAssignment(props: HotelPendingAssignmentProps) {
    const columns: DataTableColumn<HotelPendingRequestRowModel>[] = [
        {
            field: 'name',
            headerName: 'Volunteer',
            flex: 2,

            renderCell: params => {
                const href = `./${params.row.team}/volunteers/${params.row.id}`;
                return (
                    <MuiLink component={Link} href={href}>
                        {params.value}
                    </MuiLink>
                );
            },
        },
        {
            field: 'hotel',
            headerName: 'Hotel room',
            flex: 3,
        },
        {
            field: 'checkIn',
            headerName: 'Check in',
            width: 110,
        },
        {
            field: 'checkOut',
            headerName: 'Check out',
            width: 110,
        },
        {
            field: 'requested',
            headerName: 'Requested',
            width: 110,
        }
    ];

    return (
        <Paper sx={{ p: 2, mt: 2 }}>
            <Typography variant="h5" sx={{ pb: 1 }}>
                Pending assignment
            </Typography>
            <DataTable columns={columns} defaultSort={{ field: 'name', sort: 'asc' }} disableFooter
                       pageSize={100} rows={props.requests} />
        </Paper>
    );
}
