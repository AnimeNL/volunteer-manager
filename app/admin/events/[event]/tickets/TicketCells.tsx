// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Box from '@mui/material/Box';
import CardGiftcardOutlinedIcon from '@mui/icons-material/CardGiftcardOutlined';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import LocalActivityOutlinedIcon from '@mui/icons-material/LocalActivityOutlined';
import NotInterestedOutlinedIcon from '@mui/icons-material/NotInterestedOutlined';
import RemoveShoppingCartOutlinedIcon from '@mui/icons-material/RemoveShoppingCartOutlined';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import ToggleOnOutlinedIcon from '@mui/icons-material/ToggleOnOutlined';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

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
    return props.row.live ? (
        <Tooltip title="Ticket type is live">
            <ShoppingCartIcon color="success" fontSize="small" />
        </Tooltip>
    ) : (
        <Tooltip title="Ticket type is not live">
            <RemoveShoppingCartOutlinedIcon color="error" fontSize="small" />
        </Tooltip>
    );
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
    return !props.row.order ? (
        <Tooltip title="No ticket issued">
            <ConfirmationNumberOutlinedIcon color="error" fontSize="small" />
        </Tooltip>
    ) : (
        <Tooltip title="Ticket has been issued">
            <ConfirmationNumberOutlinedIcon color="success" fontSize="small" />
        </Tooltip>
    );
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
    return props.row.cancelled ? (
        <Tooltip title="Ticket has been cancelled">
            <NotInterestedOutlinedIcon color="error" fontSize="small" />
        </Tooltip>
    ) : (
        <Tooltip title="Ticket has been issued">
            <ConfirmationNumberOutlinedIcon color="success" fontSize="small" />
        </Tooltip>
    );
}

/**
 * Cell renderer for the ticket holder column. Displays the holder name, or a default value,
 * and a gift icon if the ticket was complimentary.
 */
export function HolderCell(props: { row: { holder?: string; complimentary?: boolean } }) {
    const hasHolder = !!props.row.holder;
    const label = props.row.holder || 'Unclaimed ticket';

    return (
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
            { hasHolder ? label : (
                <Typography variant="inherit" color="textDisabled" component="span"
                            sx={{ fontStyle: 'italic' }}>
                    {label}
                </Typography>
            ) }
            { !!props.row.complimentary && (
                <Tooltip title="Complimentary ticket">
                    <CardGiftcardOutlinedIcon color="primary" fontSize="inherit" />
                </Tooltip>
            ) }
        </Box>
    );
}
