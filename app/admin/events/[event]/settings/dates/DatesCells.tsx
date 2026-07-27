// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import type { ValueOptions } from '@mui/x-data-grid-premium';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import Tooltip from '@mui/material/Tooltip';
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

/**
 * The <CompletedHeader> component displays the icon representing the header of the completed status.
 */
export function CompletedHeader() {
    return (
        <Tooltip title="Has the task been completed?">
            <RadioButtonCheckedIcon fontSize="small" color="primary" />
        </Tooltip>
    );
}

/**
 * The <CompletedCell> component displays the icon representing whether the date has been completed.
 */
export function CompletedCell(props: { row: { completed: boolean } }) {
    const tooltipTitle = props.row.completed
        ? 'Task has been completed'
        : 'Task has not been completed';

    return (
        <Tooltip title={tooltipTitle}>
            {props.row.completed ? <TaskAltIcon fontSize="small" color="success" />
                                 : <RadioButtonUncheckedIcon fontSize="small" color="error" />}
        </Tooltip>
    );
}
