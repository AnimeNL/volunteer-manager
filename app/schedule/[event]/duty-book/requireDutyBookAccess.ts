// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden, notFound } from 'next/navigation';

import type { AuthenticationContext } from '@lib/auth';
import { getTeam } from '@lib/cache';
import { requireVolunteerAuthenticationWithEvent } from '@lib/auth';
import db, { tEventsTeams, tUsersEvents } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Authenticates the user for `(eventSlug, teamSlug)` and verifies that they have access to that
 * team's Duty Book—either via the `event.duty-book` permission or through an accepted volunteer
 * registration in that team.
 */
export async function requireDutyBookAccess(
    context: AuthenticationContext, eventSlug: string, teamSlug: string)
{
    const { access, event, user } =
        await requireVolunteerAuthenticationWithEvent(context, eventSlug);

    const team = await getTeam(teamSlug);
    if (!team || !team.flags.enableDutyBook)
        notFound();

    // TODO: Refactor AuthenticationContext.events to support multiple teams per event so team
    // membership checks do not need to query `users_events` directly.
    const usersEventsJoin = tUsersEvents.forUseInLeftJoin();
    const teamParticipation = await db.selectFrom(tEventsTeams)
        .leftJoin(usersEventsJoin)
            .on(usersEventsJoin.eventId.equals(tEventsTeams.eventId))
                .and(usersEventsJoin.teamId.equals(tEventsTeams.teamId))
                .and(usersEventsJoin.userId.equals(user.id))
                .and(usersEventsJoin.registrationStatus.equals(kRegistrationStatus.Accepted))
        .where(tEventsTeams.eventId.equals(event.id))
            .and(tEventsTeams.teamId.equals(team.id))
            .and(tEventsTeams.enableTeam.equals(/* true= */ 1))
        .select({
            isMember: usersEventsJoin.userId.isNotNull(),
        })
        .executeSelectNoneOrOne();

    if (!teamParticipation)
        notFound();

    const hasUnrestrictedAccess = access.can('event.duty-book', 'read', {
        event: event.slug,
        team: team.slug,
    });

    if (!hasUnrestrictedAccess && !teamParticipation.isMember)
        forbidden();

    return { access, event, hasUnrestrictedAccess, team, user };
}
