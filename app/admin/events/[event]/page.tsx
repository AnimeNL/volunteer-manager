// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { DashboardGrid } from '../../dashboard/DashboardGrid';
import { EventIdentityCard } from './dashboard/EventIdentityCard';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';

/**
 * Dashboard for the volunteering area of a particular event.
 */
export default async function EventVolunteersDashboard(props: PageProps<'/admin/events/[event]'>) {
    const { event } = await requireAuthenticationWithEvent(props);

    const cards: React.ReactNode[] = [
        <EventIdentityCard key="identity" event={event} />,
    ];

    // TODO: Deadlines
    // TODO: Environments and teams
    // TODO: Finances
    // TODO: Hotel status
    // TODO: Recent changes
    // TODO: Recent volunteers
    // TODO: Training status

    return <DashboardGrid cards={cards} />;
}

export const generateMetadata = createGenerateMetadataFn({ event: 'event' });
