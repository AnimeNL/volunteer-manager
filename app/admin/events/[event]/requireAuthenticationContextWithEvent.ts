// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import type { PermissionAccessCheck, PermissionSet, UserAuthenticationContext }
    from '@lib/auth/AuthenticationContext';
import { type CachedEvent, getEvent } from '@lib/cache';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

/**
 * Data returned by the `requireAuthenticationContextWithEvent` method.
 */
export interface UserAuthenticationContextWithEvent extends UserAuthenticationContext {
    /**
     * Information about the event that's contextual to the current request.
     */
    event: CachedEvent;
}

/**
 * Extended variant of `requireAuthenticationContext` that authenticates the user, and fetches the
 * relevant (cached) information associated with the event given in the `params`.
 */
export async function requireAuthenticationContextWithEvent(
    props: { params: Promise<{ event: string; team?: string }> },
    permission?: PermissionAccessCheck | PermissionSet)
        : Promise<UserAuthenticationContextWithEvent>
{
    const params = await props.params;
    const authenticationContext = await requireAuthenticationContext({
        check: 'admin-event',
        event: params.event,
        team: params.team,
        permission,
    });

    const event = await getEvent(params.event);
    if (!event)
        notFound();

    return { ...authenticationContext, event };
}
