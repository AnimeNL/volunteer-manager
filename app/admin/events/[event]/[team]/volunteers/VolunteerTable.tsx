// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';
import React, { useCallback } from 'react';
import { useRouter } from 'next/navigation';

import { default as MuiLink } from '@mui/material/Link';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import HistoryToggleOffIcon from '@mui/icons-material/HistoryToggleOff';
import HotelIcon from '@mui/icons-material/Hotel';
import IconButton from '@mui/material/IconButton';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import Paper from '@mui/material/Paper';
import ReadMoreIcon from '@mui/icons-material/ReadMore';
import ShareIcon from '@mui/icons-material/Share';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import type { RegistrationStatus } from '@lib/database/Types';
import { type DataTableColumn, DataTable } from '@app/admin/components/DataTable';

/**
 * Formats the given number of `seconds` to a HH:MM string.
 */
function formatSeconds(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor(seconds / 60) - hours * 60;

    return minutes ? `${hours}:${('00'+minutes).substr(-2)}`
                   : `${hours}`;
}

/**
 * Information associated with
 */
export interface VolunteerInfo {
    id: number;
    date?: string;
    status: RegistrationStatus;
    name: string;
    role: string;
    shiftCount: number;
    shiftSeconds?: number;

    availabilityEligible: boolean;
    availabilityConfirmed: boolean;

    hotelEligible?: number;
    hotelStatus?: 'available' | 'submitted' | 'skipped' | 'confirmed';

    refundRequested?: boolean;
    refundConfirmed?: boolean;

    trainingEligible?: number;
    trainingStatus?: 'available' | 'submitted' | 'skipped' | 'confirmed';
}

/**
 * Props accepted by the <VolunteerTable> component.
 */
interface VolunteerTableProps {
    /**
     * Whether a link to the data export tool should be displayed on the page.
     */
    enableExport?: boolean;

    /**
     * URL-safe slug of the event for which volunteers are being shown.
     */
    event: string;

    /**
     * URL-safe slug of the team for which volunteers are being shown.
     */
    team: string;

    /**
     * Title that should be given to this page.
     */
    title: string;

    /**
     * Information about the volunteers that should be displayed in the table. Transformations will
     * be used to add interaction to the Data Table.
     */
    volunteers: VolunteerInfo[];
}

/**
 * The <VolunteerTable> table displays an overview of all volunteers who have signed up to help out
 * in the current event, in the current team. Each volunteer will receive a detailed page.
 */
export function VolunteerTable(props: VolunteerTableProps) {
    const kVolunteerBase = `/admin/events/${props.event}/${props.team}/volunteers/`;

    const columns: DataTableColumn<VolunteerInfo>[] = [
        {
            field: 'id',
            display: 'flex',
            headerName: '',
            sortable: false,
            width: 50,

            renderCell: params =>
                <MuiLink component={Link} href={kVolunteerBase + params.value} sx={{ pt: '4px' }}>
                    <ReadMoreIcon color="info" />
                </MuiLink>,
        },
        {
            field: 'name',
            display: 'flex',
            headerName: 'Name',
            sortable: false,
            flex: 1,

            renderCell: params => {
                return (
                    <React.Fragment>
                        <MuiLink component={Link} href={kVolunteerBase + params.row.id}>
                            {params.value}
                        </MuiLink>
                        { /* TODO: Flag Senior & Staff volunteers */ }
                    </React.Fragment>
                );
            },
        },
        {
            field: 'role',
            headerName: 'Role',
            sortable: false,
            flex: 1,
        },
        {
            field: 'shiftCount',
            headerName: 'Shifts',
            sortable: true,
            width: 200,

            renderCell: params =>
                <>
                    {params.value}
                    {params.row.shiftSeconds &&
                        <Typography variant="body2" sx={{ pl: 0.5, color: 'action.active' }}>
                            ({formatSeconds(params.row.shiftSeconds)} hours)
                        </Typography> }
                </>,
        },
        {
            field: 'status',
            display: 'flex',
            headerName: 'Status',
            sortable: false,
            flex: 1,

            renderCell: params => {
                let availabilityIcon: React.ReactNode = undefined;
                if (!!params.row.availabilityConfirmed) {
                    availabilityIcon = (
                        <Tooltip title="Availability preferences shared">
                            <EventAvailableIcon color="success" fontSize="small" />
                        </Tooltip>
                    );
                } else if (!!params.row.availabilityEligible) {
                    availabilityIcon = (
                        <Tooltip title="Pending availability preferences">
                            <EventBusyIcon color="disabled" fontSize="small" />
                        </Tooltip>
                    );
                }

                let hotelIcon: React.ReactNode = undefined;
                switch (params.row.hotelStatus) {
                    case 'available':
                        hotelIcon = (
                            <Tooltip title="Pending volunteer preferences">
                                <HotelIcon color="error" fontSize="small" />
                            </Tooltip>
                        );
                        break;

                    case 'submitted':
                        hotelIcon = (
                            <Tooltip title="Preferences shared, pending confirmation">
                                <HotelIcon color="disabled" fontSize="small" />
                            </Tooltip>
                        );
                        break;

                    case 'skipped':
                        hotelIcon = (
                            <Tooltip title="Skipped">
                                <HotelIcon color="success" fontSize="small" />
                            </Tooltip>
                        );
                        break;

                    case 'confirmed':
                        hotelIcon = (
                            <Tooltip title="Confirmed">
                                <HotelIcon color="success" fontSize="small" />
                            </Tooltip>
                        );
                        break;
                }

                let refundIcon: React.ReactNode = undefined;
                if (!!params.row.refundRequested && !!params.row.refundConfirmed) {
                    refundIcon = (
                        <Tooltip title="Ticket refund issued">
                            <MonetizationOnIcon color="success" fontSize="small" />
                        </Tooltip>
                    );
                } else if (!!params.row.refundRequested) {
                    refundIcon = (
                        <Tooltip title="Ticket refund requested">
                            <MonetizationOnIcon color="error" fontSize="small" />
                        </Tooltip>
                    );
                }

                let trainingIcon: React.ReactNode = undefined;
                switch (params.row.trainingStatus) {
                    case 'available':
                        trainingIcon = (
                            <Tooltip title="Pending volunteer preferences">
                                <HistoryEduIcon color="error" fontSize="small" />
                            </Tooltip>
                        );
                        break;

                    case 'submitted':
                        trainingIcon = (
                            <Tooltip title="Preferences shared, pending confirmation">
                                <HistoryEduIcon color="disabled" fontSize="small" />
                            </Tooltip>
                        );
                        break;

                    case 'skipped':
                        trainingIcon = (
                            <Tooltip title="Skipped">
                                <HistoryEduIcon color="success" fontSize="small" />
                            </Tooltip>
                        );
                        break;

                    case 'confirmed':
                        trainingIcon = (
                            <Tooltip title="Confirmed">
                                <HistoryEduIcon color="success" fontSize="small" />
                            </Tooltip>
                        );
                        break;
                }

                return (
                    <Stack direction="row" spacing={1}>
                        {availabilityIcon}
                        {hotelIcon}
                        {refundIcon}
                        {trainingIcon}
                        { !params.row.date &&
                            <Tooltip title="Registration date missing">
                                <HistoryToggleOffIcon color="warning" fontSize="small" />
                            </Tooltip> }
                    </Stack>
                );
            },
        }
    ];

    const router = useRouter();
    const handleExportButton = useCallback(() => {
        router.push('/admin/organisation/exports/create');
    }, [ router ])

    return (
        <Paper sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}
                   sx={{ mb: 1 }}>
                <Typography variant="h5">
                    {props.title} ({props.volunteers.length} people)
                </Typography>
                { !!props.enableExport &&
                    <Tooltip title="Export volunteer list">
                        <IconButton onClick={handleExportButton}>
                            <ShareIcon fontSize="small" />
                        </IconButton>
                    </Tooltip> }
            </Stack>
            <DataTable columns={columns} rows={props.volunteers} disableFooter enableFilter
                       defaultSort={{ field: 'name', sort: 'asc' }} pageSize={100} />
        </Paper>
    )
}
