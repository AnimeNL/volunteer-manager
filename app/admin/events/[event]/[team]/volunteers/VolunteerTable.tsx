// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';
import React, { useCallback } from 'react';
import { useRouter } from 'next/navigation';

import { default as MuiLink } from '@mui/material/Link';
import EmailIcon from '@mui/icons-material/Email';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import HistoryToggleOffIcon from '@mui/icons-material/HistoryToggleOff';
import HotelIcon from '@mui/icons-material/Hotel';
import IconButton from '@mui/material/IconButton';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import Paper from '@mui/material/Paper';
import ShareIcon from '@mui/icons-material/Share';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import type { CommunicationLanguage, RegistrationStatus } from '@lib/database/Types';
import type { CommunicationPromptId } from '@lib/ai/PromptFactory';
import type { ServerActionResult } from '@lib/serverAction';
import { CommunicationButton } from '@app/admin/components/CommunicationDialog';
import { type OldDataTableColumn, OldDataTable } from '@app/admin/components/OldDataTable';

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
    firstName: string;
    name: string;
    role: string;
    shiftSeconds?: number;

    preferredLanguage?: CommunicationLanguage;
    communication: { [k in CommunicationPromptId]?: string };

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
     * Server Action to invoke when a communication should be send to the volunteer.
     */
    communicationAction: (userId: number, promptId: CommunicationPromptId)
        => Promise<ServerActionResult>;

    /**
     * Whether a link to the data export tool should be displayed on the page.
     */
    enableExport?: boolean;

    /**
     * URL-safe slug of the event for which volunteers are being shown.
     */
    event: string;

    /**
     * Unique ID of the event for which volunteers are being shown.
     */
    eventId: number;

    /**
     * Name of the event this table is being displayed for.
     */
    eventName: string;

    /**
     * URL-safe slug of the team for which volunteers are being shown.
     */
    team: string;

    /**
     * Unique ID of the team for which volunteers are being shown.
     */
    teamId: number;

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

    const columns: OldDataTableColumn<VolunteerInfo>[] = [
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
            field: 'shiftSeconds',
            headerName: 'Shifts',
            sortable: true,
            width: 200,

            renderCell: params =>
                !!params.value
                    ? <Typography component="span" variant="body2">
                          {formatSeconds(params.value)} hour{params.value === 3600 ? '' : 's'}
                      </Typography>
                    : <Typography component="span" variant="body2" color="textDisabled">
                          -
                      </Typography>,
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
        },
        {
            display: 'flex',
            field: 'id',
            width: 50,

            align: 'center',
            headerAlign: 'center',
            sortable: false,

            renderHeader: () =>
                <Tooltip title="Send them an e-mail?">
                    <EmailIcon color="action" fontSize="small" />
                </Tooltip>,

            renderCell: params => {

                return (
                    <CommunicationButton
                        title={`Update ${params.row.firstName} about ${props.eventName}?`}
                        action={props.communicationAction.bind(null, params.row.id)}
                        disableSilent
                        language={params.row.preferredLanguage}
                        recipientId={params.row.id}
                        prompts={[
                            {
                                promptId: 'event-dates-announced',
                                promptParams: {
                                    eventId: props.eventId,
                                    teamId: props.teamId,
                                },
                                title: 'Announce festival dates',
                                mostRecentCommunication:
                                    params.row.communication['event-dates-announced'],
                            },
                            {
                                promptId: 'event-hotels-announced',
                                promptParams: {
                                    eventId: props.eventId,
                                    teamId: props.teamId,
                                },
                                title: 'Announce hotel availability',
                                mostRecentCommunication:
                                    params.row.communication['event-hotels-announced'],
                            },
                            {
                                promptId: 'event-trainings-announced',
                                promptParams: {
                                    eventId: props.eventId,
                                    teamId: props.teamId,
                                },
                                title: 'Announce training availability',
                                mostRecentCommunication:
                                    params.row.communication['event-trainings-announced'],
                            }
                        ]}>

                        Send <strong>{params.row.firstName}</strong> an update about their
                        participation in {props.eventName}.

                    </CommunicationButton>
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
            <Stack direction="row" spacing={2} sx={{
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 1
            }}>
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
            <OldDataTable columns={columns} rows={props.volunteers} disableFooter
                          defaultSort={{ field: 'name', sort: 'asc' }} pageSize={100} />
        </Paper>
    )
}
