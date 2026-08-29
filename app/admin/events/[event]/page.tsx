// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { DashboardGrid } from '@app/admin/dashboard/DashboardGrid';
import { EventFinancesCard } from './dashboard/EventFinancesCard';
import { EventIdentityCard } from './dashboard/EventIdentityCard';
import { EventRecentChangesCard } from './dashboard/EventRecentChangesCard';
import { EventTeamsCard } from './dashboard/EventTeamsCard';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';

/**
 * Dashboard for the volunteering area of a particular event.
 */
export default async function EventVolunteersDashboard(props: PageProps<'/admin/events/[event]'>) {
    const { access, event } = await requireAuthenticationWithEvent(props);

    const cards: React.ReactNode[] = [
        <EventIdentityCard key="identity" event={event} />,
        <EventTeamsCard key="teams" event={event} />,
    ];

    // TODO: Deadlines

    if (access.can('statistics.finances'))
        cards.push(<EventFinancesCard key="finances" event={event} />);

    // TODO: Hotel status

    cards.push(<EventRecentChangesCard key="changes" event={event} />);

    // TODO: Recent volunteers
    // TODO: Team growth chart
    // TODO: Training status

    return <DashboardGrid cards={cards} />;
}

export const generateMetadata = createGenerateMetadataFn({ event: 'event' });
