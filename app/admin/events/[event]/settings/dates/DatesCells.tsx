// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import type { ValueOptions } from '@mui/x-data-grid-premium';
import Typography from '@mui/material/Typography';

/**
 * Props accepted by the <OwnerCell> component.
 */
interface OwnerCellProps {
    /**
     * Context passed to the cell, containing the list of leaders.
     */
    context?: {
        leaders: ValueOptions[];
    };

    /**
     * The row model for the date item.
     */
    row: {
        ownerUserId?: number | null;
    };
}

/**
 * The <OwnerCell> component displays the display name of the user who owns a date, or
 * "Unassigned" when there is no owner.
 */
export function OwnerCell(props: OwnerCellProps) {
    const ownerUserId = props.row.ownerUserId;
    if (!!ownerUserId && props.context?.leaders) {
        for (const leader of props.context.leaders) {
            if (typeof leader === 'object' && leader.value === ownerUserId)
                return <>{leader.label}</>;
        }
    }

    return (
        <Typography variant="body2" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
            Unassigned
        </Typography>
    );
}
