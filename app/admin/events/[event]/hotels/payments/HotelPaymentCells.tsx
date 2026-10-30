// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';
import EuroIcon from '@mui/icons-material/Euro';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

/**
 * Helper function for formatting payment amounts in the data table.
 */
const kPriceFormatter = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR' });

/**
 * Props accepted by the <HotelPaymentGuestCell> component.
 */
interface HotelPaymentGuestCellProps {
    /**
     * Context identifying the event for which hotel payments are being displayed.
     */
    context?: {
        event: string;
    };

    /**
     * The row model for the hotel payment item.
     */
    row: {
        name: string;
        userId?: number | null;
        team?: string | null;
        bookings: number;
    };
}

/**
 * Cell component for displaying a hotel guest, linking to their volunteer profile when they are a
 * participating volunteer, and appending a count suffix when they have multiple bookings.
 */
export function HotelPaymentGuestCell(props: HotelPaymentGuestCellProps) {
    const { bookings, name, team, userId } = props.row;

    const href =
        (props.context?.event && userId && team)
            ? `/admin/events/${props.context.event}/${team}/volunteers/${userId}`
            : undefined;

    return (
        <>
            { !href && name }
            { !!href &&
                <MuiLink component={Link} href={href}>
                    {name}
                </MuiLink> }
            { bookings > 1 &&
                <Typography component="span" variant="body2"
                            sx={{ pl: .5, color: 'text.disabled' }}>
                    ({bookings}x)
                </Typography> }
        </>
    );
}

/**
 * Props accepted by the <HotelPaymentAmountCell> component.
 */
interface HotelPaymentAmountCellProps {
    /**
     * Whether the cell is being rendered in a mobile list view.
     */
    listView?: boolean;

    /**
     * The row model for the hotel payment item.
     */
    row: {
        amount?: number | null;
        amountIsDefault?: boolean;
    };
}

/**
 * The <HotelPaymentAmountCell> component displays the hotel payment amount (stored in cents)
 * formatted in euros, in grey italics when it is a default estimate, or a disabled placeholder when
 * not set.
 */
export function HotelPaymentAmountCell(props: HotelPaymentAmountCellProps) {
    if (props.row.amount === undefined || props.row.amount === null) {
        return (
            <Typography variant="inherit" color="textDisabled" component="span"
                        sx={{ fontStyle: 'italic' }}>
                ···
            </Typography>
        );
    }

    const formattedPrice = kPriceFormatter.format(props.row.amount / 100);
    if (props.listView) {
        return (
            <Typography variant="body2" color="textSecondary" sx={{ flexShrink: 0 }}>
                {formattedPrice}
            </Typography>
        );
    }

    if (props.row.amountIsDefault) {
        return (
            <Typography variant="inherit" color="textDisabled" component="span"
                        sx={{ fontStyle: 'italic' }}>
                {formattedPrice}
            </Typography>
        );
    }

    return <>{formattedPrice}</>;
}

/**
 * Header cell for the column indicating whether the hotel payment has been received.
 */
export function HotelPaymentConfirmedHeader() {
    return (
        <Tooltip title="Has the payment been received?">
            <EuroIcon color="primary" fontSize="small" />
        </Tooltip>
    );
}

/**
 * Cell component indicating whether the hotel payment has been received.
 */
export function HotelPaymentConfirmedCell(props: { row: { confirmed: boolean } }) {
    if (props.row.confirmed) {
        return (
            <Tooltip title="Payment has been received">
                <EuroIcon color="success" fontSize="small" />
            </Tooltip>
        );
    }

    return (
        <Tooltip title="Payment has not been received">
            <EuroIcon color="error" fontSize="small" />
        </Tooltip>
    );
}
