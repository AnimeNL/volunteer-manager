// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

/**
 * Context passed to the <TrainingSessionCell> component.
 */
export interface TrainingSessionCellContext {
    /**
     * Field on the row model containing the training session ID (`0` = skip, `null`/`undefined` =
     * pending).
     */
    field: string;

    /**
     * Tooltip to display when the value is pending (`null` or `undefined`).
     */
    pendingTooltip: string;

    /**
     * Available training session options.
     */
    trainings: { value: number; label: string }[];
}

/**
 * Props accepted by the <TrainingSessionCell> component.
 */
interface TrainingSessionCellProps {
    /**
     * Context configuring the field, tooltip, and available training sessions.
     */
    context?: TrainingSessionCellContext;

    /**
     * Row model being rendered.
     */
    row: Record<string, any>;
}

/**
 * Cell component for displaying a preferred or assigned training session, showing a pending icon
 * when no selection has been made yet or muted text when skipping the training.
 */
export function TrainingSessionCell(props: TrainingSessionCellProps) {
    const field = props.context?.field ?? '';
    const value = props.row[field];

    if (value === undefined || value === null) {
        return (
            <Tooltip title={props.context?.pendingTooltip ?? 'Pending'}>
                <MoreHorizIcon color="warning" fontSize="small" />
            </Tooltip>
        );
    }

    if (value === 0) {
        return (
            <Typography component="span" variant="body2" sx={{ color: 'text.disabled' }}>
                Skip the training
            </Typography>
        );
    }

    const option = props.context?.trainings.find(entry => entry.value === value);
    if (option)
        return <>{option.label}</>;

    return <Typography variant="overline">[unknown]</Typography>;
}
