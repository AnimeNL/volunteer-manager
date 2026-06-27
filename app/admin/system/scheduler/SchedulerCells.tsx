// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import LoopIcon from '@mui/icons-material/Loop';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import RepeatIcon from '@mui/icons-material/Repeat';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { LocalDateTime } from '@app/admin/components/LocalDateTime';

/**
 * Cell rendering the header of the state column.
 */
export function StateHeader() {
    return (
        <Tooltip title="Whether the task was able to be executed">
            <TaskAltIcon color="primary" fontSize="small" />
        </Tooltip>
    );
}

/**
 * Cell rendering the state of a scheduler task.
 */
export function StateCell({ row }: {
    row: {
        state: 'pending' | 'success' | 'warning' | 'failure'
    }
}) {
    switch (row.state) {
        case 'pending':
            return (
                <Tooltip title="The task has not executed yet">
                    <RadioButtonUncheckedIcon color="disabled" fontSize="small" />
                </Tooltip>
            );

        case 'success':
            return (
                <Tooltip title="The task executed successfully">
                    <TaskAltIcon color="success" fontSize="small" />
                </Tooltip>
            );

        case 'warning':
            return (
                <Tooltip title="The task executed with a warning">
                    <TaskAltIcon color="warning" fontSize="small" />
                </Tooltip>
            );

        case 'failure':
        default:
            return (
                <Tooltip title="The task execution failed">
                    <ErrorOutlinedIcon color="error" fontSize="small" />
                </Tooltip>
            );
    }
}

/**
 * Cell rendering the scheduled date of a task, with an optional repeating task icon.
 */
export function DateCell({ row }: { row: { date: string; parentId?: number } }) {
    return (
        <>
            <Typography variant="body2" component="span">
                <LocalDateTime dateTime={row.date} fixedWidth format="YYYY-MM-DD HH:mm:ss" />
            </Typography>
            { !!row.parentId &&
                <Tooltip title="This is a repeating task">
                    <RepeatIcon fontSize="small" sx={{ ml: 1, verticalAlign: 'middle' }} color="disabled" />
                </Tooltip> }
        </>
    );
}

/**
 * Header cell for the interval column.
 */
export function IntervalHeader() {
    return (
        <Tooltip title="Repeating or one-off task?">
            <LoopIcon color="primary" fontSize="small" />
        </Tooltip>
    );
}

/**
 * Cell rendering the interval of execution for repeating tasks.
 */
export function IntervalCell({ row }: { row: { executionInterval?: number } }) {
    if (!row.executionInterval) {
        return (
            <Tooltip title="One-off task">
                <FiberManualRecordIcon color="disabled" fontSize="small" />
            </Tooltip>
        );
    } else {
        return (
            <Tooltip title={`Repeats every ${row.executionInterval}ms`}>
                <LoopIcon color="success" fontSize="small" />
            </Tooltip>
        );
    }
}
