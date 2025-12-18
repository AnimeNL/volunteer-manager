// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound, redirect } from 'next/navigation';

import { getAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tDisplaysRequests, tEvents, tTeams, tUsersEvents } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

/**
 * The <EventlessHelpRequestPageWithId> component redirects the user to the latest available
 * schedule tool for a particular help request. This link is included in WhatsApp messages.
 */
export default async function EventlessHelpRequestPageWithId(
    props: PageProps<'/schedule/help-request/[id]'>)
{
    const { access, user } = await getAuthenticationContext();

    const params = await props.params;

    const dbInstance = db;
    const event = await dbInstance.selectFrom(tDisplaysRequests)
        .innerJoin(tEvents)
            .on(tEvents.eventId.equals(tDisplaysRequests.requestEventId))
        .where(tDisplaysRequests.requestId.equals(parseInt(params.id, /* radix= */ 10)))
        .selectOneColumn(tEvents.eventSlug)
        .executeSelectNoneOrOne();

    if (!event)
        notFound();

    if (!user || !access.can('event.help-requests', { event }))
        redirect('/');

    const environment = await db.selectFrom(tEvents)
        .innerJoin(tUsersEvents)
            .on(tUsersEvents.eventId.equals(tEvents.eventId))
                .and(tUsersEvents.userId.equals(user.id))
                .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tUsersEvents.teamId))
        .where(tEvents.eventSlug.equals(event))
        .selectOneColumn(tTeams.teamEnvironment)
        .executeSelectNoneOrOne();

    if (!!environment)
        redirect(`https://${environment}/schedule/${event}/help-requests/${params.id}`);
    else
        redirect(`/schedule/${event}/help-requests/${params.id}`);
}
