// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Typography from '@mui/material/Typography';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

import type { EventSalesCategory } from '@lib/database/Types';

/**
 * Object containing the valid event sale categories, together with a human readable description of
 * what they represent. This object is used to populate the dropdown in the sales configuration.
 */
export const kEventSaleCategoryOptions: { [k in EventSalesCategory]: string } = {
    Event: 'Event',
    Hidden: 'Hidden',
    Locker: 'Locker',
    LockerFriday: 'Locker (Friday)',
    LockerSaturday: 'Locker (Saturday)',
    LockerSunday: 'Locker (Sunday)',
    LockerWeekend: 'Locker (Weekend)',
    TicketFriday: 'Ticket (Friday)',
    TicketSaturday: 'Ticket (Saturday)',
    TicketSunday: 'Ticket (Sunday)',
    TicketWeekend: 'Ticket (Weekend)',
};

/**
 * Props accepted by the <PriceCell> component.
 */
interface PriceCellProps {
    /**
     * The row model for the financial setting item.
     */
    row: {
        price?: number | null;
    };
}

/**
 * The <PriceCell> component displays the price formatted in euros, or "Unknown" when not set.
 */
export function PriceCell(props: PriceCellProps) {
    if (props.row.price === undefined || props.row.price === null) {
        return (
            <Typography component="span" variant="body2" sx={{ color: 'text.disabled' }}>
                Unknown
            </Typography>
        );
    }

    return <>€{Math.round(props.row.price * 100) / 100}</>;
}

/**
 * Props accepted by the <CategoryCell> component.
 */
interface CategoryCellProps {
    /**
     * The row model for the financial setting item.
     */
    row: {
        category?: EventSalesCategory | 'null' | null;
    };
}

/**
 * The <CategoryCell> component displays the readable category label, a hidden icon when applicable,
 * or "Uncategorised" when no category is assigned.
 */
export function CategoryCell(props: CategoryCellProps) {
    const category = props.row.category;
    if (category === 'Hidden') {
        return (
            <>
                <Typography component="span" variant="body2" sx={{ color: 'grey.600', pt: 0.25 }}>
                    Hidden
                </Typography>
                <VisibilityOffIcon color="disabled" fontSize="inherit"
                                   sx={{ ml: 0.5, mt: 0.25 }} />
            </>
        );
    }

    if (category && category !== 'null' && category in kEventSaleCategoryOptions) {
        return <>{kEventSaleCategoryOptions[category as EventSalesCategory]}</>;
    }

    return (
        <Typography component="span" variant="body2" sx={{ color: 'text.disabled' }}>
            Uncategorised
        </Typography>
    );
}
