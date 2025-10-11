// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import LoopIcon from '@mui/icons-material/Loop';
import Paper from '@mui/material/Paper';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import RepeatIcon from '@mui/icons-material/Repeat';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import type { SchedulerRowModel } from '@app/api/admin/scheduler/[[...id]]/route';
import { RemoteDataTable, type RemoteDataTableColumn } from '@app/admin/components/RemoteDataTable';
import { Temporal, formatDate } from '@lib/Temporal';

/**
 * The <SchedulerTaskTable> component displays a data table with the pending and past tasks that
 * were executed by the scheduler. This component does not take any props.
 */
export function SchedulerTaskTable() {
    const columns: RemoteDataTableColumn<SchedulerRowModel>[] = [
        {
            field: 'state',
            display: 'flex',
            headerName: '',
            sortable: false,
            align: 'center',
            width: 50,

            renderCell: params => {
                switch (params.value) {
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

                    case 'error':
                    default:
                        return (
                            <Tooltip title="The task execution failed">
                                <ErrorOutlineIcon color="error" fontSize="small" />
                            </Tooltip>
                        );
                }
            },
        },
        {
            field: 'date',
            display: 'flex',
            headerName: 'Scheduled for…',
            sortable: false,
            flex: 1,

            renderCell: params => {
                return (
                    <>
                        <Typography variant="body2">
                            { formatDate(
                                Temporal.ZonedDateTime.from(params.value), 'YYYY-MM-DD HH:mm:ss') }
                        </Typography>
                        { !!params.row.parentId &&
                            <Tooltip title="This is a repeating task" color="disabled">
                                <RepeatIcon fontSize="small" sx={{ ml: 1 }} />
                            </Tooltip> }
                    </>
                );
            },
        },
        {
            field: 'task',
            headerName: 'Task',
            sortable: false,
            flex: 2,

            renderCell: params =>
                <MuiLink component={Link} href={`./scheduler/${params.row.id}`}>
                    {params.value}
                </MuiLink>,
        },
        {
            field: 'executionInterval',
            display: 'flex',
            headerName: '',
            sortable: false,
            align: 'center',
            width: 50,

            renderCell: params => {
                if (!params.value) {
                    return (
                        <Tooltip title="One-off task">
                            <FiberManualRecordIcon color="disabled" fontSize="small" />
                        </Tooltip>
                    );
                }

                return (
                    <Tooltip title={`Repeats every ${params.value}ms`}>
                        <LoopIcon color="success" fontSize="small" />
                    </Tooltip>
                );
            },
        },
        {
            field: 'executionTime',
            headerName: 'Time',
            sortable: false,
            width: 100,

            renderCell: params => {
                if (!params.value) {
                    return (
                        <Typography component="span" sx={{ color: 'text.disabled' }}
                                    variant="body2">
                            n/a
                        </Typography>
                    );
                } else if (params.value < 10) {
                    return `${Math.round(params.value * 10) / 10}ms`;
                } else if (params.value < 1000) {
                    return `${Math.round(params.value)}ms`;
                } else if (params.value < 60000) {
                    return `${Math.round(params.value / 1000)}s`;
                } else {
                    return `${Math.round(params.value / 60000)}m`;
                }
            },
        }
    ];

    return (
        <Paper sx={{ p: 2 }}>
            <Typography variant="h5">
                System scheduler
            </Typography>
            <Alert severity="info" sx={{ mt: 1, mb: 2 }}>
                The <strong>system scheduler</strong> is the component to run tasks (such as sending
                an e-mail) in the background, either as a one-off or at a configured interval.
            </Alert>
            <RemoteDataTable columns={columns} endpoint="/api/admin/scheduler" enableQueryParams
                             defaultSort={{ field: 'date', sort: 'desc' }} pageSize={25} />
        </Paper>
    );
}
