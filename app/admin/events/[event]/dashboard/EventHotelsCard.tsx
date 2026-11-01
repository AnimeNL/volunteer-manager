// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import HotelIcon from '@mui/icons-material/Hotel';

import type { CachedEvent } from '@lib/cache';
import { EventWarningCard } from './EventWarningCard';

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

    /**
     * Whether hotel room information has been published to volunteers.
     */
    published?: boolean;
}

/**
 * Event dashboard card that displays hotel room status, or a warning when hotel room information
 * has not been published yet.
 */
export async function EventHotelsCard(props: EventHotelsCardProps) {
    if (!props.event.flags.enableHotel)
        return null;

    if (!props.published) {
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

    return null;
}
