// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import LanOutlinedIcon from '@mui/icons-material/LanOutlined';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { DashboardCard } from './DashboardCard';
import { DashboardCardHeader } from './DashboardCardHeader';
import { getConnectionPool, getQueryCount } from '@lib/database/Connection';

/**
 * Helper to format numbers in a human readable manner.
 */
const kNumberFormatter = Intl.NumberFormat('en-UK');

/**
 * The <DatabaseCard> displays state of the database connection owned by the Volunteer Manager. This
 * is not of interest to most users, but it fills up a little bit of screen estate so why not.
 */
export async function DatabaseCard() {
    const connectionPool = getConnectionPool();
    if (!connectionPool)
        return null;

    const taskQueueSize = connectionPool.taskQueueSize();
    const taskQueueSuffix = taskQueueSize === 1 ? '' : 's';

    const formattedQueryCount = kNumberFormatter.format(getQueryCount());

    return (
        <DashboardCard>
            <DashboardCardHeader src="/images/admin/database-header.jpg?v2"
                                 title="Database" secondary />
            <Stack sx={{ px: 2, pb: 1 }}>
                <Typography variant="h6" sx={{ mt: 1 }}>
                    Database status
                </Typography>
                <List dense disablePadding>
                    <ListItem disableGutters>
                        <ListItemIcon>
                            <LanOutlinedIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={
                            <Typography variant="inherit">
                                {connectionPool.activeConnections()} connections
                                <Typography component="span" variant="inherit"
                                            color="textDisabled">
                                    {' '}/ {connectionPool.idleConnections()} idle
                                </Typography>
                            </Typography>
                        } />
                    </ListItem>
                    <ListItem disableGutters>
                        <ListItemIcon>
                            <QueryStatsIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={`${formattedQueryCount} queries executed`} />
                    </ListItem>
                    <ListItem disableGutters>
                        <ListItemIcon>
                            <HourglassBottomIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={`${taskQueueSize} pending task${taskQueueSuffix}`} />
                    </ListItem>
                </List>
            </Stack>
        </DashboardCard>
    );
}
