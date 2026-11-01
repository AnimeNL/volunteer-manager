// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';

import Divider from '@mui/material/Divider';
import HotelIcon from '@mui/icons-material/Hotel';
import IconButton from '@mui/material/IconButton';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { CachedEvent } from '@lib/cache';
import { DashboardCard } from '@app/admin/dashboard/DashboardCard';
import db, { tEvents } from '@lib/database';

/**
 * Props accepted by the <EventHotelsCard> component.
 */
interface EventHotelsCardProps {
    /**
     * Whether the signed-in user has access to manage hotel rooms for this event.
     */
    canManageHotels?: boolean;

    /**
     * Event for which the card is being displayed.
     */
    event: CachedEvent;
}

/**
 * Event dashboard card that displays a warning when hotel room information has not been published
 * yet for an event where hotel management is enabled.
 */
export async function EventHotelsCard(props: EventHotelsCardProps) {
    if (!props.event.flags.enableHotel)
        return null;

    const published = await db.selectFrom(tEvents)
        .where(tEvents.eventId.equals(props.event.id))
        .selectOneColumn(tEvents.hotelInformationPublished.equals(/* true= */ 1))
        .executeSelectNoneOrOne();

    if (published)
        return null;

    return (
        <DashboardCard warning>
            <Stack direction="row" spacing={1.5}
                   divider={ <Divider flexItem orientation="vertical" /> }
                   sx={{
                       alignItems: 'center',
                       px: 2,
                       py: 1.5,
                   }}>
                <HotelIcon color="warning" fontSize="large" />
                <Stack direction="column" sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" noWrap>
                        Hotel information has not been published yet
                    </Typography>
                    <Typography variant="body2">
                        Volunteers cannot view hotel room options or submit their preferences until
                        the information has been published.
                    </Typography>
                </Stack>
                { !!props.canManageHotels &&
                    <IconButton component={Link}
                                href={`/admin/events/${props.event.slug}/hotels/settings`}>
                        <NavigateNextIcon color="action" />
                    </IconButton> }
            </Stack>
        </DashboardCard>
    );
}
