// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import CelebrationOutlinedIcon from '@mui/icons-material/CelebrationOutlined';
import Divider from '@mui/material/Divider';
import DoneAllOutlinedIcon from '@mui/icons-material/DoneAllOutlined';
import EventIcon from '@mui/icons-material/Event';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { CachedEvent } from '@lib/cache';
import { DashboardCard } from '@app/admin/dashboard/DashboardCard';
import { DashboardCardHeader } from '@app/admin/dashboard/DashboardCardHeader';
import { formatDate, isBefore } from '@lib/Temporal';

/**
 * Props accepted by the <EventIdentityCard> component.
 */
interface EventIdentityCardProps {
    /**
     * Event for which the card is being displayed.
     */
    event: CachedEvent;
}

/**
 * Dashboard card for displaying the event's identity, countdown, and basic location information.
 */
export async function EventIdentityCard(props: EventIdentityCardProps) {
    const { event } = props;

    const currentTime = Temporal.Now.zonedDateTimeISO(event.startTime.timeZoneId);

    let remainingTime: number | undefined;
    let remainingTimeState: 'future' | 'present' | 'past' = 'future';
    let remainingTimeUnit: string | undefined;

    const remainingWeeks = currentTime.until(event.startTime, { largestUnit: 'weeks' });
    if (remainingWeeks.weeks > 1) {
        remainingTime = remainingWeeks.weeks;
        remainingTimeUnit = 'weeks';
    } else if (remainingWeeks.weeks === 1) {
        remainingTime = remainingWeeks.weeks;
        remainingTimeUnit = 'week';
    } else if (isBefore(currentTime, event.endTime)) {
        remainingTimeState = 'present';
    } else {
        remainingTimeState = 'past';
    }

    const startDate = formatDate(event.startTime, 'MMM D');
    const endDate = formatDate(event.endTime, 'MMM D, YYYY');

    return (
        <DashboardCard>
            <DashboardCardHeader src={event.imageUrl}
                                 renderTitle title={event.name} />
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center', px: 2 }}>
                <List dense sx={{ flexGrow: 1 }}>
                    <ListItem disableGutters>
                        <ListItemIcon>
                            <EventIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={`${startDate} – ${endDate}`} />
                    </ListItem>
                    { !!event.location &&
                        <ListItem disableGutters>
                            <ListItemIcon>
                                <LocationOnOutlinedIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText primary={event.location} />
                        </ListItem> }
                </List>
                <Divider flexItem orientation="vertical" sx={{ my: '8px !important' }} />
                <Stack direction="column" sx={{ alignItems: 'center', paddingX: 1 }}>
                    { remainingTimeState === 'future' &&
                        <>
                            <Typography variant="h5">
                                {remainingTime}
                            </Typography>
                            <Typography variant="body2">
                                {remainingTimeUnit}
                            </Typography>
                        </> }
                    { remainingTimeState === 'present' &&
                        <CelebrationOutlinedIcon color="success" fontSize="large" /> }
                    { remainingTimeState === 'past' &&
                        <DoneAllOutlinedIcon color="success" fontSize="large" /> }
                </Stack>
            </Stack>
        </DashboardCard>
    );
}
