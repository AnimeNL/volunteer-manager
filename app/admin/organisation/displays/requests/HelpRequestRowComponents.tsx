// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Chip from '@mui/material/Chip';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import Tooltip from '@mui/material/Tooltip';

import { kHelpRequestColours } from './HelpRequestColours';

/**
 * Component that renders the target category label with appropriate background and foreground
 * colors.
 */
export function HelpRequestTargetCell({ row }: { row: { target: string } }) {
    const colours = kHelpRequestColours[row.target as keyof typeof kHelpRequestColours];
    if (!colours)
        return <Chip label={row.target} size="small" />;

    const [ foreground, background ] = colours;
    return (
        <Chip label={row.target} size="small"
              sx={{ backgroundColor: background, color: foreground }} />
    );
}

/**
 * Component that renders the status icon (fulfilled/closed, acknowledged, or pending) with
 * tooltips.
 */
export function HelpRequestStatusCell({ row }: {
    row: {
        acknowledgedBy?: string;
        closedBy?: string;
    }
}) {
    if (!!row.closedBy) {
        return (
            <Tooltip title="Request has been fulfilled">
                <CheckCircleIcon fontSize="small" color="success" />
            </Tooltip>
        );
    } else if (!!row.acknowledgedBy) {
        return (
            <Tooltip title="Request has been acknowledged">
                <ErrorOutlinedIcon fontSize="small" color="warning" />
            </Tooltip>
        );
    } else {
        return (
            <Tooltip title="Request is still pending">
                <CancelIcon fontSize="small" color="error" />
            </Tooltip>
        );
    }
}
