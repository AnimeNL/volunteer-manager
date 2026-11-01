// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import EventBusyIcon from '@mui/icons-material/EventBusy';

import type { CachedEvent } from '@lib/cache';
import { EventWarningCard } from './EventWarningCard';

/**
 * Props accepted by the <EventAvailabilityCard> component.
 */
interface EventAvailabilityCardProps {
    /**
     * Whether the signed-in user has access to manage settings for this event.
     */
    canManageSettings?: boolean;

    /**
     * Event for which the card is being displayed.
     */
    event: CachedEvent;

    /**
     * Whether availability information has been published to volunteers.
     */
    published?: boolean;
}

/**
 * Event dashboard card that displays availability status, or a warning when availability
 * information has not been published yet.
 */
export async function EventAvailabilityCard(props: EventAvailabilityCardProps) {
    if (!props.published) {
        const href = props.canManageSettings
            ? `/admin/events/${props.event.slug}/settings/configuration`
            : undefined;

        return (
            <EventWarningCard href={href}
                              icon={ <EventBusyIcon color="warning" fontSize="large" /> }
                              title="Availability information has not been published yet">
                Volunteers cannot view the festival program or submit their availability preferences
                until the information has been published.
            </EventWarningCard>
        );
    }

    return null;
}
