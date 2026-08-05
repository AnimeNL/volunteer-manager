// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import LocalActivityOutlinedIcon from '@mui/icons-material/LocalActivityOutlined';
import Tooltip from '@mui/material/Tooltip';

/**
 * Header cell of the column to indicate ticket validity.
 */
export function ValidityHeaderCell() {
    return (
        <Tooltip title="Has the ticket been cancelled?">
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
                <ConfirmationNumberOutlinedIcon color="error" fontSize="small" />
            </Tooltip>
        );
    } else {
        return (
            <Tooltip title="Ticket is valid">
                <ConfirmationNumberOutlinedIcon color="success" fontSize="small" />
            </Tooltip>
        );
    }
}
