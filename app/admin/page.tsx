// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import { ActivityCard } from './dashboard/ActivityCard';
import { BirthdayCard } from './dashboard/BirthdayCard';
import { DashboardGrid } from './dashboard/DashboardGrid';
import { DatabaseCard } from './dashboard/DatabaseCard';
import { EventCard } from './dashboard/EventCard';
import { ProfilePromotionCard } from './dashboard/ProfilePromotionCard';
import { SchedulerCard } from './dashboard/SchedulerCard';
import { TodoCard, queryTodoItems } from './dashboard/TodoCard';
import { WelcomeCard } from './dashboard/WelcomeCard';
import { readUserSettings } from '@lib/UserSettings';
import { requireAuthentication } from '@lib/auth';

/**
 * Main dashboard of the AnimeCon Volunteer Manager. Includes various cards in a masonry layout that
 * give an overview of what's going on. Exact cards depend on the user's access level.
 */
export default async function AdminPage() {
    const { access, user } = await requireAuthentication();

    const [ userSettings, todoItems ] = await Promise.all([
        readUserSettings(user.id, [ 'ai-example-messages' ], /* disableFallback= */ true),
        queryTodoItems(user.id, access),
    ]);

    const cards: React.ReactNode[] = [
        <EventCard key="event-card" access={access} />,
    ];

    if (todoItems.length > 0)
        cards.push(<TodoCard key="todo-card" items={todoItems} />);

    cards.push(<BirthdayCard key="birthday-card" access={access} />);

    if (access.can('system.logs', 'read'))
        cards.push(<ActivityCard key="activity-card" />);

    if (!userSettings['ai-example-messages']?.length)
        cards.push(<ProfilePromotionCard key="profile-promotion-card" />);

    if (access.can('system.internals.cache'))
        cards.push(<DatabaseCard key="database-card" />);

    if (access.can('system.internals.scheduler'))
        cards.push(<SchedulerCard key="scheduler-card" />);

    cards.push(<WelcomeCard key="welcome" />);

    return <DashboardGrid cards={cards} />;
}

export const metadata: Metadata = {
    title: 'AnimeCon Volunteer Manager',
};
