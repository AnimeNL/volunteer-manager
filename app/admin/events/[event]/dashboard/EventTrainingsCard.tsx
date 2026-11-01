// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import HistoryEduIcon from '@mui/icons-material/HistoryEdu';

import type { CachedEvent } from '@lib/cache';
import { EventWarningCard } from './EventWarningCard';

/**
 * Props accepted by the <EventTrainingsCard> component.
 */
interface EventTrainingsCardProps {
    /**
     * Whether the signed-in user has access to manage trainings for this event.
     */
    canManageTrainings?: boolean;

    /**
     * Event for which the card is being displayed.
     */
    event: CachedEvent;

    /**
     * Whether training information has been published to volunteers.
     */
    published?: boolean;
}

/**
 * Event dashboard card that displays training status, or a warning when training information has
 * not been published yet.
 */
export async function EventTrainingsCard(props: EventTrainingsCardProps) {
    if (!props.event.flags.enableTraining)
        return null;

    if (!props.published) {
        const href = props.canManageTrainings
            ? `/admin/events/${props.event.slug}/training/settings`
            : undefined;

        return (
            <EventWarningCard href={href}
                              icon={ <HistoryEduIcon color="warning" fontSize="large" /> }
                              title="Training information has not been published yet">
                Volunteers cannot view training sessions or submit their preferences until the
                information has been published.
            </EventWarningCard>
        );
    }

    return null;
}
