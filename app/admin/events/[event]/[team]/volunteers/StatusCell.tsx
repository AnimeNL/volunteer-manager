// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import EventBusyIcon from '@mui/icons-material/EventBusy';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import HotelIcon from '@mui/icons-material/Hotel';
import LocalActivityOutlinedIcon from '@mui/icons-material/LocalActivityOutlined';
import PaidIcon from '@mui/icons-material/Paid';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';

import type { VolunteerRowModel } from './dataSource';

const kDisabledIconSx = { color: 'rgba(0, 0, 0, .15)' } as const;

/**
 * Props accepted by the <StatusCell> component.
 */
interface StatusCellProps {
    /**
     * Row model for the volunteer.
     */
    row: VolunteerRowModel;

    /**
     * Whether the cell is being rendered in a list view.
     */
    listView?: boolean;
}

/**
 * Cell used to display the status of a volunteer's application.
 */
export function StatusCell(props: StatusCellProps) {
    const { status } = props.row;

    let availabilityIcon: React.ReactNode;
    if (status.availabilityEligible) {
        if (status.availabilityPreferences) {
            availabilityIcon = (
                <Tooltip title="Availability preferences shared">
                    <EventBusyIcon color="success" fontSize="small" />
                </Tooltip>
            );
        } else {
            availabilityIcon = (
                <Tooltip title="Waiting for availability preferences">
                    <EventBusyIcon color="warning" fontSize="small" />
                </Tooltip>
            );
        }
    } else if (!props.listView) {
        availabilityIcon = (
            <Tooltip title="Not eligible to share availability">
                <EventBusyIcon color="disabled" fontSize="small" sx={kDisabledIconSx} />
            </Tooltip>
        );
    }

    let hotelIcon: React.ReactNode;
    if (status.hotelConfirmed) {
        hotelIcon = (
            <Tooltip title="Confirmed for a hotel room">
                <HotelIcon color="success" fontSize="small" />
            </Tooltip>
        );
    } else if (status.hotelEligible) {
        if (status.hotelPreferences === 0) {
            hotelIcon = (
                <Tooltip title="Declined a hotel room">
                    <HotelIcon color="success" fontSize="small" />
                </Tooltip>
            );
        } else if (status.hotelPreferences === 1) {
            hotelIcon = (
                <Tooltip title="Requested a hotel room">
                    <HotelIcon color="warning" fontSize="small" />
                </Tooltip>
            );
        } else {
            hotelIcon = (
                <Tooltip title="Waiting for hotel preferences">
                    <HotelIcon color="warning" fontSize="small" />
                </Tooltip>
            );
        }
    } else if (!props.listView) {
        hotelIcon = (
            <Tooltip title="Not eligible for a room">
                <HotelIcon color="disabled" fontSize="small" sx={kDisabledIconSx} />
            </Tooltip>
        );
    }

    let trainingIcon: React.ReactNode;
    if (status.trainingConfirmed) {
        trainingIcon = (
            <Tooltip title="Confirmed for training">
                <HistoryEduIcon color="success" fontSize="small" />
            </Tooltip>
        );
    } else if (status.trainingEligible) {
        if (status.trainingPreferences === 0) {
            trainingIcon = (
                <Tooltip title="Skipped training participation">
                    <HistoryEduIcon color="success" fontSize="small" />
                </Tooltip>
            );
        } else if (status.trainingPreferences !== undefined) {
            trainingIcon = (
                <Tooltip title="Requested training participation">
                    <HistoryEduIcon color="warning" fontSize="small" />
                </Tooltip>
            );
        } else {
            trainingIcon = (
                <Tooltip title="Waiting for training preferences">
                    <HistoryEduIcon color="warning" fontSize="small" />
                </Tooltip>
            );
        }
    } else if (!props.listView) {
        trainingIcon = (
            <Tooltip title="Not eligible for training">
                <HistoryEduIcon color="disabled" fontSize="small" sx={kDisabledIconSx} />
            </Tooltip>
        );
    }

    let ticketIcon: React.ReactNode;
    if (status.ticketEligible) {
        if (!props.row.ticket) {
            ticketIcon = (
                <Tooltip title="Has not received a ticket">
                    <LocalActivityOutlinedIcon color="error" fontSize="small" />
                </Tooltip>
            );
        } else {
            ticketIcon = (
                <Tooltip title="Received a ticket">
                    <LocalActivityOutlinedIcon color="success" fontSize="small" />
                </Tooltip>
            );
        }
    } else if (!props.listView) {
        ticketIcon = (
            <Tooltip title="Not eligible for a ticket">
                <LocalActivityOutlinedIcon color="disabled" fontSize="small" sx={kDisabledIconSx} />
            </Tooltip>
        );
    }

    let refundIcon: React.ReactNode;
    if (status.refundConfirmed) {
        refundIcon = (
            <Tooltip title="Ticket refund issued">
                <PaidIcon color="success" fontSize="small" />
            </Tooltip>
        );
    } else if (status.refundPreferences) {
        refundIcon = (
            <Tooltip title="Ticket refund requested">
                <PaidIcon color="warning" fontSize="small" />
            </Tooltip>
        );
    } else if (!props.listView) {
        refundIcon = (
            <Tooltip title="Not eligible for a refund">
                <PaidIcon color="disabled" fontSize="small" sx={kDisabledIconSx} />
            </Tooltip>
        );
    }

    return (
        <Stack direction="row" spacing={1}>
            {availabilityIcon}
            {hotelIcon}
            {trainingIcon}
            {ticketIcon}
            {refundIcon}
        </Stack>
    );
}
