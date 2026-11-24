// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden, notFound } from 'next/navigation';

import type { AuthenticationContext } from '@lib/auth';
import { getTeam } from '@lib/cache';
import { requireVolunteerAuthenticationWithEvent } from '@lib/auth';
import db, { tEventsTeams } from '@lib/database';

/**
 * Authenticates the user for `(eventSlug, teamSlug)` and verifies that they have access to that
 * team's Duty Book—either via the `event.duty-book` permission or through an accepted volunteer
 * registration in that team.
 */
export async function requireDutyBookAccess(
    context: AuthenticationContext, eventSlug: string, teamSlug: string)
{
    const { access, event, events, user } =
        await requireVolunteerAuthenticationWithEvent(context, eventSlug);

    const team = await getTeam(teamSlug);
    if (!team || !team.flags.enableDutyBook)
        notFound();

    const teamEnabled = await db.selectFrom(tEventsTeams)
        .where(tEventsTeams.eventId.equals(event.id))
            .and(tEventsTeams.teamId.equals(team.id))
            .and(tEventsTeams.enableTeam.equals(/* true= */ 1))
        .selectOneColumn(tEventsTeams.teamId)
        .executeSelectNoneOrOne();

    if (!teamEnabled)
        notFound();

    const hasUnrestrictedAccess = access.can('event.duty-book', 'read', {
        event: event.slug,
        team: team.slug,
    });

    const isTeamMember = !!events.get(event.slug)?.has(team.slug);
    if (!hasUnrestrictedAccess && !isTeamMember)
        forbidden();

    return { access, event, hasUnrestrictedAccess, team, user };
}
