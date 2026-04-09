// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound, redirect } from 'next/navigation';

import { getAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tDutyBook, tEvents, tUsersEvents, tTeams } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

/**
 * The <EventlessDutyBookPageWithId> component redirects the user to the event-specific schedule
 * instance to which the Duty Book entry with the given ID belongs. We don't do any permission
 * verifications: the IDs are sequential, so the worst case information leakage is the number of
 * incidents reports we stored per event, which is fine for people to know.
 */
export default async function EventlessDutyBookPageWithId(
    props: PageProps<'/schedule/duty-book/[id]'>)
{
    const { user } = await getAuthenticationContext();
    if (!user)
        redirect('/');

    const params = await props.params;

    const dbInstance = db;
    const event = await dbInstance.selectFrom(tDutyBook)
        .innerJoin(tEvents)
            .on(tEvents.eventId.equals(tDutyBook.dutyBookEventId))
        .where(tDutyBook.dutyBookId.equals(parseInt(params.id, /* radix= */ 10)))
            .and(tDutyBook.dutyBookDeleted.isNull())
        .selectOneColumn(tEvents.eventSlug)
        .executeSelectNoneOrOne();

    if (!event)
        notFound();

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
        redirect(`https://${environment}/schedule/${event}/duty-book`);
    else
        redirect(`/schedule/${event}/duty-book/${params.id}`);
}
