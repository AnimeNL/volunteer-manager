// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import type { AuthenticationContext, PermissionAccessCheck, PermissionSet }
    from '@lib/auth/AuthenticationContext';
import { executeAccessCheck }from '@lib/auth/AuthenticationContext';
import { type CachedEvent, getEvent } from '@lib/cache';

/**
 * Data returned by the `requireAuthenticationWithEvent` method.
 */
interface RequireAuthenticationWithEventResult {
    /**
     * Information about the event that's contextual to the current request.
     */
    event: CachedEvent;
}

/**
 * Extended variant of `requireAuthenticationContext` that authenticates the user, and fetches the
 * relevant (cached) information associated with the event given in the `params`.
 */
export async function requireAuthenticationWithEvent(
    eventIdentifier: number | string,
    authenticationContext: AuthenticationContext,
    permission?: PermissionAccessCheck | PermissionSet)
        : Promise<RequireAuthenticationWithEventResult>
{
    const event = await getEvent(eventIdentifier);
    if (!event)
        notFound();

    executeAccessCheck(authenticationContext, {
        check: 'admin-event',
        event: event.slug,
        permission,
    }, {
        event: event.slug
    });

    return { event };
}
