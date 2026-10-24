// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound, unauthorized } from 'next/navigation';

import type { Environment } from '@lib/Environment';
import type { EnvironmentContext, EnvironmentContextEventAccess } from '@lib/EnvironmentContext';
import { EventApplicationPage } from './EventApplicationPage';
import db, { tEventsTeams, tTeams, tUsersEvents } from '@lib/database';

/**
 * Props accepted by the <EventApplicationStatus> component.
 */
interface EventApplicationStatusProps {
    /**
     * Context for which the page is being rendered.
     */
    context: EnvironmentContext;

    /**
     * Environment for which the page is being rendered.
     */
    environment: Environment;

    /**
     * Event for which the page is being rendered.
     */
    event: EnvironmentContextEventAccess;

    /**
     * URL-safe slug of the team for which the status should be displayed.
     */
    team: string;
}

/**
 * The <EventApplicationStatus> component displays the status of a volunteer's application. This is
 * a server-side component that fetches the relevant information autonomously.
 */
export async function EventApplicationStatus(props: EventApplicationStatusProps) {
    const { context, event, team } = props;

    if (!context.user)
        unauthorized();

    const registration = await db.selectFrom(tUsersEvents)
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tUsersEvents.teamId))
                .and(tTeams.teamSlug.equals(team))
        .innerJoin(tEventsTeams)
            .on(tEventsTeams.eventId.equals(tUsersEvents.eventId))
                .and(tEventsTeams.teamId.equals(tUsersEvents.teamId))
        .where(tUsersEvents.userId.equals(context.user.id))
            .and(tUsersEvents.eventId.equals(event.id))
        .select({
            status: tUsersEvents.registrationStatus,
            team: {
                id: tTeams.teamId,
                slug: tTeams.teamSlug,
                title: tTeams.teamTitle,
            },
            whatsAppLink: tEventsTeams.whatsappLink,
        })
        .executeSelectNoneOrOne();

    if (!registration)
        notFound();

    return (
        <EventApplicationPage context={context} event={event} registration={registration}
                              user={context.user} />
    );
}
