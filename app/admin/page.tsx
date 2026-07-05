// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import { default as TopLevelLayout } from './TopLevelLayout';
import { DashboardGrid } from './dashboard/DashboardGrid';
import { DatabaseCard } from './dashboard/DatabaseCard';
import { EventCard } from './dashboard/EventCard';
import { SchedulerCard } from './dashboard/SchedulerCard';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';


/**
 * Main dashboard of the AnimeCon Volunteer Manager. Includes various cards in a masonry layout that
 * give an overview of what's going on. Exact cards depend on the user's access level.
 */
export default async function AdminPage() {
    await requireAuthenticationContext({ check: 'admin' });

    const cards: React.ReactNode[] = [
        <EventCard key="event-card" />,
        // TODO: Birthday card
        // TODO: Logs card
        <DatabaseCard key="database-card" />,
        <SchedulerCard key="scheduler-card" />,
    ];

    return (
        <TopLevelLayout>
            <DashboardGrid cards={cards} />
        </TopLevelLayout>
    );
}

export const metadata: Metadata = {
    title: 'AnimeCon Volunteer Manager',
};
