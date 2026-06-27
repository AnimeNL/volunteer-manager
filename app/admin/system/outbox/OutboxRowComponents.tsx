// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Tooltip from '@mui/material/Tooltip';

/**
 * Cell that renders an icon indicating delivery success or failure.
 */
export function MessageDeliveredCell({ row }: { row: { delivered: boolean } }) {
    if (row.delivered) {
        return (
            <Tooltip title="Message has been delivered">
                <CheckCircleIcon fontSize="small" color="success" />
            </Tooltip>
        );
    } else {
        return (
            <Tooltip title="Delivery has not completed (yet)">
                <CancelIcon fontSize="small" color="error" />
            </Tooltip>
        );
    }
}
