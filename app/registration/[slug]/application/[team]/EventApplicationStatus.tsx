// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound, unauthorized } from 'next/navigation';

import type { Environment } from '@lib/Environment';
import type { EnvironmentContext, EnvironmentContextEventAccess } from '@lib/EnvironmentContext';
import { EventApplicationPage } from './EventApplicationPage';
import { getRegistration } from './getRegistration';
import db, { tEvents, tEventsTeams, tTeams } from '@lib/database';

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

    // ---------------------------------------------------------------------------------------------
    // Load and compose information about the event for which status has to be shown. This includes
    // the availability windows for individual fields.
    // ---------------------------------------------------------------------------------------------

    const info = await db.selectFrom(tEvents)
        .innerJoin(tTeams)
            .on(tTeams.teamSlug.equals(team))
        .innerJoin(tEventsTeams)
            .on(tEventsTeams.eventId.equals(tEvents.eventId))
                .and(tEventsTeams.teamId.equals(tTeams.teamId))
        .where(tEvents.eventId.equals(event.id))
        .select({
            teamId: tTeams.teamId,
            teamTitle: tTeams.teamTitle,

            event: {
                hotelEnabled: tEvents.hotelEnabled.equals(/* true= */ 1),
                refundEnabled: tEvents.refundEnabled.equals(/* true= */ 1),
                timezone: tEvents.eventTimezone,
                trainingEnabled: tEvents.trainingEnabled.equals(/* true= */ 1),
                whatsAppLink: tEventsTeams.whatsappLink,
            },
            availabilityWindows: {
                hotelPreferences: {
                    start: tEvents.hotelPreferencesStart,
                    end: tEvents.hotelPreferencesEnd,
                },
                refundRequests: {
                    start: tEvents.refundRequestsStart,
                    end: tEvents.refundRequestsEnd,
                },
                trainingPreferences: {
                    start: tEvents.trainingPreferencesStart,
                    end: tEvents.trainingPreferencesEnd,
                },
            },
        })
        .executeSelectNoneOrOne();

    if (!info)
        notFound();

    // ---------------------------------------------------------------------------------------------

    const publishPortal = event.publishPortal === 'active' || event.publishPortal === 'override';

    const eventInfo = {
        ...info.event,
        enableSchedule: publishPortal,
        shortName: event.shortName,
        slug: event.slug,
    };

    // ---------------------------------------------------------------------------------------------
    // Load information about the application. This needs to be substantially more detailed than
    // the |applications| contained within the environment context so far.
    // ---------------------------------------------------------------------------------------------

    const registration = await getRegistration(event.id, info.teamId, context.user.id);
    if (!registration)
        notFound();

    // ---------------------------------------------------------------------------------------------

    return (
        <EventApplicationPage availabilityWindows={info.availabilityWindows || {}} context={context}
                              event={eventInfo} registration={registration} team={team}
                              teamTitle={info.teamTitle} user={context.user!} />
    );
}


