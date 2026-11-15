// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Typography from '@mui/material/Typography';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

import type { EventTicketCategory } from '@lib/database/Types';

import { kEventTicketCategoryOptions } from './Settings';

/**
 * Props accepted by the <CategoryCell> component.
 */
interface CategoryCellProps {
    /**
     * The row model for the financial setting item.
     */
    row: {
        category?: EventTicketCategory | '' | 'null' | null;
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

    if (category && category !== 'null' && category in kEventTicketCategoryOptions)
        return <>{kEventTicketCategoryOptions[category as EventTicketCategory]}</>;

    return (
        <Typography component="span" color="textDisabled" variant="body2">
            Uncategorised
        </Typography>
    );
}
