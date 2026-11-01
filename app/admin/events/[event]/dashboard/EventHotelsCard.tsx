// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import HotelIcon from '@mui/icons-material/Hotel';

import type { CachedEvent } from '@lib/cache';
import { EventWarningCard } from './EventWarningCard';
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

    const href = props.canManageHotels
        ? `/admin/events/${props.event.slug}/hotels/settings`
        : undefined;

    return (
        <EventWarningCard href={href} icon={ <HotelIcon color="warning" fontSize="large" /> }
                          title="Hotel information has not been published yet">
            Volunteers cannot view hotel room options or submit their preferences until the
            information has been published.
        </EventWarningCard>
    );
}
