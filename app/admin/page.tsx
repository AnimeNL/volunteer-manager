// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import { default as TopLevelLayout } from './TopLevelLayout';
import { ActivityCard } from './dashboard/ActivityCard';
import { BirthdayCard } from './dashboard/BirthdayCard';
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
    const { access } = await requireAuthenticationContext({ check: 'admin' });

    // TODO: Permission checks for all of this.

    // TODO: Birthday page - navigation
    // TODO: Birthday page - proper mobile view

    // TODO: Birthday card - better styling

    const cards: React.ReactNode[] = [
        <EventCard key="event-card" />,
        <BirthdayCard key="birthday-card" access={access} />,
        <ActivityCard key="activity-card" />,
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
