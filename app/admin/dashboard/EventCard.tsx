// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';

import Button from '@mui/material/Button';
import EventIcon from '@mui/icons-material/Event';
import GroupsIcon from '@mui/icons-material/Groups';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { DashboardCard } from './DashboardCard';
import { EventCardHeader } from './EventCardHeader';
import { EventCardHighlight } from './EventCardHighlight';
import { Temporal, formatDate } from '@lib/Temporal';
import { getBlobUrl } from '@lib/database/BlobStore';
import db, { tEvents, tStorage } from '@lib/database';

/**
 * Number of days for which the previous event highlight should remain visible on the card.
 */
const kPreviousEventHighlightCutoffDays = 210;

/**
 * The <EventCard> displays the upcoming event's logo, together with the ability to click through to
 * the volunteers area straight away. When the previous event recently finished and hasn't been
 * disabled yet, a little pop-out will be shown to quickly navigate there as well.
 *
 * This card deals with multiple upcoming or recently concluded events by only selecting the nearest
 * future event, and the nearest concluded event. This filtering is done in this method.
 */
export async function EventCard() {
    const previousEventCutoffDate = Temporal.Now.zonedDateTimeISO().subtract({
        days: kPreviousEventHighlightCutoffDays,
    });

    const storageJoin = tStorage.forUseInLeftJoin();

    const dbInstance = db;
    const events = await dbInstance.selectFrom(tEvents)
        .leftJoin(storageJoin)
            .on(storageJoin.fileId.equals(tEvents.eventIdentityId))
        .where(tEvents.eventHidden.equals(/* false= */ 0))
            .and(tEvents.eventEndTime.greaterOrEqual(dbInstance.currentZonedDateTime())
                .or(tEvents.eventEndTime.greaterOrEqual(previousEventCutoffDate)))
        .select({
            id: tEvents.eventId,
            slug: tEvents.eventSlug,
            name: tEvents.eventName,
            shortName: tEvents.eventShortName,
            startTime: tEvents.eventStartTime,
            endTime: tEvents.eventEndTime,
            location: tEvents.eventLocation,
            identityHash: storageJoin.fileHash,
            concluded: tEvents.eventEndTime.lessOrEqual(dbInstance.currentZonedDateTime()),
        })
        .orderBy(tEvents.eventEndTime, 'desc')
        .limit(/* ~two upcoming and ~two recent events= */ 4)
        .executeSelectMany();

    let upcomingEvent: typeof events[number] | undefined;
    let recentEvent: typeof events[number] | undefined;

    for (const event of events) {
        if (event.concluded && !recentEvent) {
            recentEvent = event;
        } else if (!event.concluded) {
            upcomingEvent = event;
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Edge case: No events available at all.
    // ---------------------------------------------------------------------------------------------

    if (!upcomingEvent && !recentEvent)
        return null;

    // ---------------------------------------------------------------------------------------------
    // Edge case: No upcoming events, but there is a recent event.
    // ---------------------------------------------------------------------------------------------

    if (!upcomingEvent)
        return null;

    // ---------------------------------------------------------------------------------------------
    // Expected case: Upcoming event, and optionally a recent event.
    // ---------------------------------------------------------------------------------------------

    const startDate = formatDate(upcomingEvent.startTime, 'MMM D');
    const endDate = formatDate(upcomingEvent.endTime, 'MMM D, YYYY');

    return (
        <DashboardCard>
            <EventCardHeader src={ getBlobUrl(upcomingEvent.identityHash) }
                             title={upcomingEvent.name} />
            <Stack sx={{ px: 2, pb: 2 }}>
                <div>
                    <Typography variant="h6" sx={{ mt: 1 }}>
                        {upcomingEvent.shortName}
                    </Typography>
                    <Typography variant="body1" color="primary" sx={{ fontWeight: 'bold' }}>
                        {extractThemeFromEventName(upcomingEvent.name)}
                    </Typography>
                </div>
                <List dense>
                    <ListItem disableGutters>
                        <ListItemIcon>
                            <EventIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={`${startDate} – ${endDate}`} />
                    </ListItem>
                    { !!upcomingEvent.location &&
                        <ListItem disableGutters>
                            <ListItemIcon>
                                <LocationOnOutlinedIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText primary={upcomingEvent.location} />
                        </ListItem> }
                </List>
                <Button variant="contained" startIcon={ <GroupsIcon /> }
                        LinkComponent={Link} href={`/admin/events/${upcomingEvent.slug}`}>
                    Volunteers
                </Button>
            </Stack>
            { recentEvent &&
                <EventCardHighlight href={`/admin/events/${recentEvent.slug}`}
                                    name={recentEvent.shortName} /> }
        </DashboardCard>
    );
}

/**
 * Attempts to extract the theme from the event name.
 *
 * @todo At some point maybe separate out { shortName, theme }, deprecating { name } altogether?
 */
function extractThemeFromEventName(eventName: string): string {
    const themeOffset = eventName.indexOf(': ');
    return themeOffset >= 0 ? eventName.slice(themeOffset + 2)
                            : 'Unknown Theme';
}
