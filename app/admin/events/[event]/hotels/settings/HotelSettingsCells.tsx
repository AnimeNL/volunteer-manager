// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

/**
 * Helper function for formatting prices in the configuration data table.
 */
const kPriceFormatter = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR' });

/**
 * Props accepted by the <PriceCell> component.
 */
interface PriceCellProps {
    /**
     * Whether the cell is being rendered in a mobile list view.
     */
    listView?: boolean;

    /**
     * The row model for the hotel room item.
     */
    row: {
        roomPrice: number;
    };
}

/**
 * The <PriceCell> component displays the hotel room price (stored in cents) formatted in euros.
 */
export function PriceCell(props: PriceCellProps) {
    const formattedPrice = kPriceFormatter.format((props.row.roomPrice ?? 0) / 100);
    if (props.listView) {
        return (
            <Typography variant="body2" color="textSecondary" sx={{ flexShrink: 0 }}>
                {formattedPrice}
            </Typography>
        );
    }

    return <>{formattedPrice}</>;
}

/**
 * Header component for the private room column.
 */
export function PrivateHeader() {
    return (
        <Tooltip title="Is the room advertised?">
            <VisibilityIcon color="primary" fontSize="small" />
        </Tooltip>
    );
}

/**
 * Cell component for displaying whether a hotel room is kept private.
 */
export function PrivateCell(props: { row: { private: boolean } }) {
    if (props.row.private) {
        return (
            <Tooltip title="This room is hidden from volunteers">
                <VisibilityOffIcon color="error" fontSize="small" />
            </Tooltip>
        );
    }

    return (
        <Tooltip title="This room is publicly advertised">
            <VisibilityIcon color="disabled" fontSize="small" />
        </Tooltip>
    );
}
