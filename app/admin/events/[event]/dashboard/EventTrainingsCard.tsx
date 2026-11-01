// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import HistoryEduIcon from '@mui/icons-material/HistoryEdu';

import type { CachedEvent } from '@lib/cache';
import { EventWarningCard } from './EventWarningCard';
import db, { tEvents } from '@lib/database';

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
}

/**
 * Event dashboard card that displays a warning when training information has not been published yet
 * for an event where training management is enabled.
 */
export async function EventTrainingsCard(props: EventTrainingsCardProps) {
    if (!props.event.flags.enableTraining)
        return null;

    const published = await db.selectFrom(tEvents)
        .where(tEvents.eventId.equals(props.event.id))
        .selectOneColumn(tEvents.trainingInformationPublished.equals(/* true= */ 1))
        .executeSelectNoneOrOne();

    if (published)
        return null;

    const href = props.canManageTrainings
        ? `/admin/events/${props.event.slug}/training/settings`
        : undefined;

    return (
        <EventWarningCard href={href} icon={ <HistoryEduIcon color="warning" fontSize="large" /> }
                          title="Training information has not been published yet">
            Volunteers cannot view training sessions or submit their preferences until the
            information has been published.
        </EventWarningCard>
    );
}
