// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import type { PermissionAccessCheck, PermissionSet } from '@lib/auth/AuthenticationContext';
import type { UserAuthenticationContextWithEvent } from './requireAuthenticationContextWithEvent';
import { type CachedTeam, getTeam } from '@lib/cache';
import { requireAuthenticationContextWithEvent } from './requireAuthenticationContextWithEvent';

/**
 * Data returned by the `requireAuthenticationContextWithEventAndTeam` method.
 */
interface UserAuthenticationContextWithEventAndTeam extends UserAuthenticationContextWithEvent {
    /**
     * Information about the team that's contextual to the current request.
     */
    team: CachedTeam;
}

/**
 * Extended variant of `requireAuthenticationContext` that authenticates the user, and fetches the
 * relevant (cached) information associated with the event given in the `params`.
 */
export async function requireAuthenticationContextWithEventAndTeam(
    props: { params: Promise<{ event: string; team: string }> },
    permission?: PermissionAccessCheck | PermissionSet)
        : Promise<UserAuthenticationContextWithEventAndTeam>
{
    const params = await props.params;
    const authenticationContext = await requireAuthenticationContextWithEvent(props, permission);

    const team = await getTeam(params.team);
    if (!team)
        notFound();

    return { ...authenticationContext, team };
}
