// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import type { AuthenticationContext, PermissionAccessCheck, PermissionSet }
    from '@lib/auth/AuthenticationContext';
import { type CachedTeam, getTeam } from '@lib/cache';
import { type RequireAuthenticationWithEventResult, requireAuthenticationWithEvent }
    from './requireAuthenticationWithEvent';

/**
 * Data returned by the `requireAuthenticationWithEventAndTeam` method.
 */
interface RequireAuthenticationWithEventAndTeamResult extends RequireAuthenticationWithEventResult {
    /**
     * Information about the team that's contextual to the current request.
     */
    team: CachedTeam;
}

/**
 * Extended variant of `requireAuthenticationWithEvent` that authenticates the user, and fetches the
 * relevant (cached) information associated with the team given in the `params`.
 */
export async function requireAuthenticationWithEventAndTeam(
    eventIdentifier: number | string,
    teamIdentifier: number | string,
    authenticationContext: AuthenticationContext,
    permission?: PermissionAccessCheck | PermissionSet)
        : Promise<RequireAuthenticationWithEventAndTeamResult>
{
    const team = await getTeam(teamIdentifier);
    if (!team)
        notFound();

    const { event } = await requireAuthenticationWithEvent(
        eventIdentifier, authenticationContext, permission, team.slug);

    return { event, team };
}
