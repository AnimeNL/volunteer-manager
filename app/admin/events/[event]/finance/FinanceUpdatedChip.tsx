// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';

import { LocalDateTime } from '@app/admin/components/LocalDateTime';

/**
 * Props accepted by the <FinanceUpdatedChip> component.
 */
interface FinanceUpdatedChipProps {
    /**
     * ISO 8601 string or date time representation of when the data was most recently updated.
     */
    updated: string;
}

/**
 * Displays a chip indicating when the financial data was most recently updated.
 */
export function FinanceUpdatedChip(props: FinanceUpdatedChipProps) {
    return (
        <Tooltip title="Data updated on…">
            <Chip size="small" color="primary" variant="outlined" label={
                <LocalDateTime dateTime={props.updated} format="dddd, MMMM Do [at] HH:mm" />
            } />
        </Tooltip>
    );
}
