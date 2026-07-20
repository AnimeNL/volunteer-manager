// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { DashboardCard } from './DashboardCard';
import { DashboardCardHeader } from './DashboardCardHeader';
import { LocalDateDuration } from '../components/LocalDateDuration';
import { logsDataSource } from '../system/diagnostics/logs/LogsDataSource';

/**
 * Number of log entries to display in this card.
 */
const kEntriesToDisplay = 5;

/**
 * The <ActivityCard> displays the most recent actions that were taken in the Volunteer Manager, and
 * by who. It's a quick way to understand whether something has changed since your last visit.
 */
export async function ActivityCard() {
    const { rows } = await logsDataSource.list({ /* no context */ }, {
        end: kEntriesToDisplay - 1,
        filterModel: { items: [ /* none */ ] },
        sortModel: [ { field: 'date', sort: 'desc' } ],
        start: 0,
    });

    return (
        <DashboardCard>
            <DashboardCardHeader src="/images/admin/activity-header.jpg?v2"
                                 title="Database" secondary />
            <Stack sx={{ px: 2, pb: 1 }}>
                <Typography variant="h6" sx={{ mt: 1 }}>
                    Recent activity
                </Typography>
                { !rows.length &&
                    <Alert severity="warning" variant="outlined" sx={{ mt: 1, mb: 2 }}>
                        Quiet around here… a little too quiet!
                    </Alert> }
                { !!rows.length &&
                    <List dense>
                        { rows.map(row =>
                            <ListItem key={row.id} disableGutters>
                                <ListItemIcon>
                                    <InfoOutlinedIcon fontSize="small" />
                                </ListItemIcon>
                                <ListItemText primary={row.message}
                                              secondary={row.initiatorUser?.name}
                                              slotProps={{
                                                  primary: { noWrap: true },
                                                  secondary: { noWrap: true },
                                              }} />
                                <Typography color="textDisabled" variant="body2" noWrap
                                            sx={{ ml: 2, flexShrink: 0 }}>
                                    <LocalDateDuration dateTime={row.date} />
                                </Typography>
                            </ListItem> ) }
                    </List> }
                <Button variant="outlined" sx={{ mb: 1 }} startIcon={ <ReceiptOutlinedIcon /> }
                        LinkComponent={Link} href="/admin/system/diagnostics/logs">
                    System logs
                </Button>
            </Stack>
        </DashboardCard>
    );
}
