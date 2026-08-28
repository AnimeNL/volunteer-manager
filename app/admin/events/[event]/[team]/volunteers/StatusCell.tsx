// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import EventBusyIcon from '@mui/icons-material/EventBusy';
import HotelIcon from '@mui/icons-material/Hotel';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
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

    // TODO: Availability [eligibility, preferences]
    // TODO: Hotel room [preferences, confirmed]
    // TODO: Training [preferences, confirmed]
    // TODO: Refund [preferences, confirmed]

    let hotelIcon: React.ReactNode;
    if (!!status.hotelEligible) {
        hotelIcon = (
            <Tooltip title="Eligible for a room">
                <HotelIcon color="action" fontSize="small" />
            </Tooltip>
        );
    } else if (!props.listView) {
        hotelIcon = (
            <Tooltip title="Not eligible for a room">
                <HotelIcon color="disabled" fontSize="small" sx={kDisabledIconSx} />
            </Tooltip>
        );
    }

    let trainingIcon: React.ReactNode;
    if (!!status.trainingEligible) {
        trainingIcon = (
            <Tooltip title="Eligible for training">
                <HistoryEduIcon color="action" fontSize="small" />
            </Tooltip>
        );
    } else if (!props.listView) {
        trainingIcon = (
            <Tooltip title="Not eligible for training">
                <HistoryEduIcon color="disabled" fontSize="small" sx={kDisabledIconSx} />
            </Tooltip>
        );
    }

    let ticketIcon: React.ReactNode;
    if (!!status.ticketEligible) {
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
    }

    let refundIcon: React.ReactNode;
    if (!props.listView) {
        refundIcon = (
            <Tooltip title="Refund status unknown">
                <PaidIcon color="disabled" fontSize="small" sx={kDisabledIconSx} />
            </Tooltip>
        );
    }

    return (
        <Stack direction="row" spacing={1}>
            <Tooltip title="Availability status unknown">
                <EventBusyIcon color="disabled" fontSize="small" sx={kDisabledIconSx} />
            </Tooltip>
            {hotelIcon}
            {trainingIcon}
            {ticketIcon}
            {refundIcon}
        </Stack>
    );
}
