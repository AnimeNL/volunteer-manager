// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound, redirect } from 'next/navigation';

import { getAuthenticationContext } from '@lib/auth';
import db, { tDutyBook, tEvents, tTeams } from '@lib/database';

/**
 * The <EventlessDutyBookPageWithId> component redirects the user to the event- and team-specific
 * schedule instance to which the Duty Book entry with the given ID belongs. We don't do any
 * permission verifications: the IDs are sequential, so the worst case information leakage is the
 * number of incidents reports we stored per event, which is fine for people to know.
 */
export default async function EventlessDutyBookPageWithId(
    props: PageProps<'/schedule/duty-book/[id]'>)
{
    const { user } = await getAuthenticationContext();
    if (!user)
        redirect('/');

    const params = await props.params;

    const incident = await db.selectFrom(tDutyBook)
        .innerJoin(tEvents)
            .on(tEvents.eventId.equals(tDutyBook.dutyBookEventId))
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tDutyBook.dutyBookTeamId))
        .where(tDutyBook.dutyBookId.equals(parseInt(params.id, /* radix= */ 10)))
            .and(tDutyBook.dutyBookDeleted.isNull())
        .select({
            environment: tTeams.teamEnvironment,
            event: tEvents.eventSlug,
            team: tTeams.teamSlug,
        })
        .executeSelectNoneOrOne();

    if (!incident)
        notFound();

    const target = `/schedule/${incident.event}/duty-book/${incident.team}`;
    if (!!incident.environment)
        redirect(`https://${incident.environment}${target}`);
    else
        redirect(target);
}
