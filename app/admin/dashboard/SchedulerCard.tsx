// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';

import Alert from '@mui/material/Alert';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import LoopIcon from '@mui/icons-material/Loop';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import Stack from '@mui/material/Stack';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import Typography from '@mui/material/Typography';

import { DashboardCard } from './DashboardCard';
import { DashboardCardHeader } from './DashboardCardHeader';
import { Temporal, formatDuration } from '@lib/Temporal';

import { globalScheduler } from '@lib/scheduler/SchedulerImpl';

/**
 * Helper to format numbers in a human readable manner.
 */
const kNumberFormatter = Intl.NumberFormat('en-UK');

/**
 * The <SchedulerCard> displays state of the internal task scheduler. This is not of interest to
 * most users, but fills up screen estate with data useful to some... or, rather, one.
 */
export async function SchedulerCard() {
    let timeSinceLastExecution: string | undefined = undefined;
    if (globalScheduler.lastExecution !== undefined) {
        const diffNs = process.hrtime.bigint() - globalScheduler.lastExecution;
        const diffMs = diffNs / 1000n / 1000n;

        const timeSinceLastExecutionMs = Number(diffMs);
        const timeSinceLastExecutionDuration = Temporal.Duration.from({
            milliseconds: timeSinceLastExecutionMs,
        }).round({ largestUnit: 'days' });

        timeSinceLastExecution = formatDuration(timeSinceLastExecutionDuration, true);
        if (timeSinceLastExecution !== 'now')
            timeSinceLastExecution += ' ago';
    }

    let timeSinceLastInvocation: string | undefined = undefined;
    if (globalScheduler.lastInvocation !== undefined) {
        const diffNs = process.hrtime.bigint() - globalScheduler.lastInvocation;
        const diffMs = diffNs / 1000n / 1000n;

        const timeSinceLastInvocationMs = Number(diffMs);
        const timeSinceLastInvocationDuration = Temporal.Duration.from({
            milliseconds: timeSinceLastInvocationMs,
        }).round({ largestUnit: 'days' });

        timeSinceLastInvocation = formatDuration(timeSinceLastInvocationDuration, true);
        if (timeSinceLastInvocation !== 'now')
            timeSinceLastInvocation += ' ago';
    }

    const formattedExecutionCount = kNumberFormatter.format(globalScheduler.executionCount);
    const formattedExecutionSuffix = globalScheduler.executionCount === 1n ? '' : 's';

    const formattedInvocationCount = kNumberFormatter.format(globalScheduler.invocationCount);
    const formattedInvocationSuffix = globalScheduler.invocationCount === 1n ? '' : 's';

    const formattedPending = kNumberFormatter.format(globalScheduler.taskQueueSize);

    return (
        <DashboardCard>
            <DashboardCardHeader src="/images/admin/scheduler-header.jpg?v2"
                                 title="Database" secondary />
            <Stack sx={{ px: 2, pb: 1 }}>
                <Typography variant="h6" sx={{ mt: 1 }}>
                    Scheduler status
                </Typography>
                { timeSinceLastExecution === undefined &&
                    <Alert severity="warning" variant="outlined" sx={{ my: 1 }}>
                        The scheduler is not currently running.
                    </Alert> }
                { timeSinceLastExecution !== undefined &&
                    <List dense disablePadding>
                        <ListItem disableGutters>
                            <ListItemIcon>
                                <LoopIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText primary={
                                <Typography variant="inherit">
                                    {formattedExecutionCount} run{formattedExecutionSuffix}
                                    <Typography component="span" variant="inherit"
                                                color="textDisabled">
                                        {' '}— {timeSinceLastExecution}
                                    </Typography>
                                </Typography>
                            } />
                        </ListItem>
                        <ListItem disableGutters>
                            <ListItemIcon>
                                <TaskAltIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText primary={
                                <Typography variant="inherit">
                                    {formattedInvocationCount} task{formattedInvocationSuffix}
                                    {' '}executed
                                    { !!timeSinceLastInvocation &&
                                        <Typography component="span" variant="inherit"
                                                    color="textDisabled">
                                            {' '}— {timeSinceLastInvocation}
                                        </Typography> }
                                </Typography>
                            } />
                        </ListItem>
                        <ListItem disableGutters>
                            <ListItemIcon>
                                <HourglassBottomIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText primary={
                                <Typography variant="inherit">
                                    {formattedPending} pending tasks
                                    <IconButton LinkComponent={Link} href="/admin/system/scheduler"
                                                size="small" sx={{
                                        position: 'absolute',
                                        marginTop: '-4px',
                                        marginLeft: '6px',
                                    }}>
                                        <NavigateNextIcon color="info" fontSize="small" />
                                    </IconButton>
                                </Typography>
                            } />
                        </ListItem>
                    </List> }
            </Stack>
        </DashboardCard>
    );
}
