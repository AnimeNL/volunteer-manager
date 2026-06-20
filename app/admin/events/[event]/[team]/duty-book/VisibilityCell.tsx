// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Tooltip from '@mui/material/Tooltip';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

/**
 * Header component for the visibility column.
 */
export function VisibilityHeaderCell() {
    return (
        <Tooltip title="Are the details available?">
            <VisibilityIcon fontSize="small" color="primary" />
        </Tooltip>
    );
}

/**
 * Cell component for the visibility status.
 */
export function VisibilityCell({ row }: { row: { hidden?: boolean } }) {
    if (row.hidden) {
        return (
            <Tooltip title="Details have been hidden">
                <VisibilityOffIcon fontSize="small" color="error" />
            </Tooltip>
        );
    } else {
        return (
            <Tooltip title="Details are available">
                <VisibilityIcon fontSize="small" color="success" />
            </Tooltip>
        );
    }
}
