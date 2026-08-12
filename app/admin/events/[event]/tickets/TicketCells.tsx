// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import LocalActivityOutlinedIcon from '@mui/icons-material/LocalActivityOutlined';
import NotInterestedOutlinedIcon from '@mui/icons-material/NotInterestedOutlined';
import ToggleOnOutlinedIcon from '@mui/icons-material/ToggleOnOutlined';
import Tooltip from '@mui/material/Tooltip';

/**
 * Header cell of the column to indicate whether the ticket type is active.
 */
export function LiveHeaderCell() {
    return (
        <Tooltip title="Is the ticket type live?">
            <ToggleOnOutlinedIcon color="primary" fontSize="small" />
        </Tooltip>
    );
}

/**
 * Cell that indicates whether the ticket type is live.
 */
export function LiveCell(props: { row: { live: boolean } }) {
    if (props.row.live) {
        return (
            <Tooltip title="Ticket type is live">
                <CheckCircleOutlinedIcon color="success" fontSize="small" />
            </Tooltip>
        );
    } else {
        return (
            <Tooltip title="Ticket type is not live">
                <CancelOutlinedIcon color="error" fontSize="small" />
            </Tooltip>
        );
    }
}

/**
 * Header cell of the column to indicate whether a ticket has been issued.
 */
export function IssuedHeaderCell() {
    return (
        <Tooltip title="Has a ticket been issued?">
            <LocalActivityOutlinedIcon color="primary" fontSize="small" />
        </Tooltip>
    );
}

/**
 * Cell that indicates whether the ticket has been issued.
 */
export function IssuedCell(props: { row: { order?: string } }) {
    if (!props.row.order) {
        return (
            <Tooltip title="No ticket issued">
                <ConfirmationNumberOutlinedIcon color="error" fontSize="small" />
            </Tooltip>
        );
    } else {
        return (
            <Tooltip title="Ticket has been issued">
                <ConfirmationNumberOutlinedIcon color="success" fontSize="small" />
            </Tooltip>
        );
    }
}

/**
 * Header cell of the column to indicate ticket validity.
 */
export function ValidityHeaderCell() {
    return (
        <Tooltip title="Status of the ticket?">
            <LocalActivityOutlinedIcon color="primary" fontSize="small" />
        </Tooltip>
    );
}

/**
 * Cell that indicates whether the ticket is still valid.
 */
export function ValidityCell(props: { row: { cancelled: boolean } }) {
    if (props.row.cancelled) {
        return (
            <Tooltip title="Ticket has been cancelled">
                <NotInterestedOutlinedIcon color="error" fontSize="small" />
            </Tooltip>
        );
    } else {
        return (
            <Tooltip title="Ticket has been issued">
                <ConfirmationNumberOutlinedIcon color="success" fontSize="small" />
            </Tooltip>
        );
    }
}
