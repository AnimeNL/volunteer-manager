// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { CachedEvent } from '@lib/cache';
import { ActivityTypeCell } from '../activity/ActivityRowComponents';
import { DashboardCard } from '@app/admin/dashboard/DashboardCard';
import { DashboardCardTitle } from '@app/admin/dashboard/DashboardCardTitle';
import { LocalDateDuration } from '@app/admin/components/LocalDateDuration';
import { eventActivityDataSource } from '../activity/EventActivityDataSource';

/**
 * Props accepted by the <EventRecentChangesCard> component.
 */
interface EventRecentChangesCardProps {
    /**
     * Event for which the card is being displayed.
     */
    event: CachedEvent;
}

/**
 * Event dashboard card that displays changes recently made by volunteers in our teams.
 */
export async function EventRecentChangesCard(props: EventRecentChangesCardProps) {
    const { rows } = await eventActivityDataSource.list({ event: props.event.slug }, {
        end: 7,
        filterModel: { items: [] },
        sortModel: [ { field: 'date', sort: 'desc' } ],
        start: 0,
    });

    return (
        <DashboardCard>
            <DashboardCardTitle icon={ <NotificationsActiveOutlinedIcon /> }>
                Recent activity
            </DashboardCardTitle>
            <Stack direction="column" spacing={2} sx={{ mx: 2, mb: 2 }}>
                { !rows.length &&
                    <Alert severity="warning" variant="outlined" sx={{ mt: '8px !important' }}>
                       No activity has taken place yet.
                    </Alert> }

                { !!rows.length &&
                    <List dense disablePadding sx={{ marginBottom: '-8px !important' }}>
                        { rows.map(row => (
                            <ListItem key={row.id} disableGutters>
                                <ListItemIcon>
                                    <ActivityTypeCell row={{ type: row.type }} />
                                </ListItemIcon>
                                <ListItemText
                                    slotProps={{ primary: { noWrap: true } }}
                                    primary={
                                        <Typography variant="body2" noWrap>
                                            <MuiLink component={Link} href={row.href}>
                                                {row.user.firstName}
                                            </MuiLink>
                                            {' '}{row.description.toLowerCase()}
                                        </Typography>
                                    } />
                                <Typography color="textDisabled" variant="body2" noWrap
                                            sx={{ ml: 2, flexShrink: 0 }}>
                                    <LocalDateDuration dateTime={row.date} />
                                </Typography>
                            </ListItem>
                        )) }
                    </List> }

                <Button variant="outlined" startIcon={ <ReceiptOutlinedIcon /> }
                        LinkComponent={Link} href={`/admin/events/${props.event.slug}/activity`}>
                    All recent activity
                </Button>
            </Stack>
        </DashboardCard>
    );
}
