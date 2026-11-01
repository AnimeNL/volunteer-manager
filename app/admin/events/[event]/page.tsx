// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { DashboardGrid } from '@app/admin/dashboard/DashboardGrid';
import { EventAvailabilityCard } from './dashboard/EventAvailabilityCard';
import { EventDeadlinesCard } from './dashboard/EventDeadlinesCard';
import { EventFinancesCard } from './dashboard/EventFinancesCard';
import { EventHotelsCard } from './dashboard/EventHotelsCard';
import { EventIdentityCard } from './dashboard/EventIdentityCard';
import { EventRecentChangesCard } from './dashboard/EventRecentChangesCard';
import { EventTeamsCard } from './dashboard/EventTeamsCard';
import { EventTrainingsCard } from './dashboard/EventTrainingsCard';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';
import db, { tEvents } from '@lib/database';

import { kEventAvailabilityStatus } from '@lib/database/Types';

/**
 * Dashboard for the volunteering area of a particular event.
 */
export default async function EventVolunteersDashboard(props: PageProps<'/admin/events/[event]'>) {
    const { access, event } = await requireAuthenticationWithEvent(props);

    const configuration = await db.selectFrom(tEvents)
        .where(tEvents.eventId.equals(event.id))
        .select({
            availabilityPublished:
                tEvents.eventAvailabilityStatus.notEquals(kEventAvailabilityStatus.Unavailable),
            hotelInformationPublished: tEvents.hotelInformationPublished.equals(/* true= */ 1),
            trainingInformationPublished:
                tEvents.trainingInformationPublished.equals(/* true= */ 1),
        })
        .executeSelectNoneOrOne();

    const cards: React.ReactNode[] = [
        <EventIdentityCard key="identity" event={event} />,
        <EventTeamsCard key="teams" event={event} />,
    ];

    if (access.can('statistics.finances'))
        cards.push(<EventFinancesCard key="finances" event={event} />);

    cards.push(<EventRecentChangesCard key="changes" event={event} />);
    cards.push(<EventDeadlinesCard key="deadlines" event={event} />);

    if (configuration && !configuration.availabilityPublished) {
        const canManageSettings = access.can('event.settings', { event: event.slug });
        cards.push(
            <EventAvailabilityCard key="availability" canManageSettings={canManageSettings}
                                   event={event}
                                   published={configuration.availabilityPublished} />);
    }

    if (event.flags.enableHotel && configuration) {
        const canManageHotels = access.can('event.hotels', { event: event.slug });
        cards.push(
            <EventHotelsCard key="hotels" canManageHotels={canManageHotels} event={event}
                             published={configuration.hotelInformationPublished} />);
    }

    if (event.flags.enableTraining && configuration) {
        const canManageTrainings = access.can('event.trainings', { event: event.slug });
        cards.push(
            <EventTrainingsCard key="trainings" canManageTrainings={canManageTrainings}
                                event={event}
                                published={configuration.trainingInformationPublished} />);
    }

    return <DashboardGrid cards={cards} />;
}

export const generateMetadata = createGenerateMetadataFn({ event: 'event' });
