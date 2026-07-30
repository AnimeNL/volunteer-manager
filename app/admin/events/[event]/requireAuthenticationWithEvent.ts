// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import type { BooleanPermission } from '@lib/auth/Access';
import { type AuthenticationContext, type PermissionAccessCheck, executeAccessCheck }
    from '@lib/auth/AuthenticationContext';
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
    permission?: Omit<PermissionAccessCheck, 'scope'>)
        : Promise<RequireAuthenticationWithEventResult>
{
    const event = await getEvent(eventIdentifier);
    if (!event)
        notFound();

    let accessCheckPermission: PermissionAccessCheck | undefined;

    // Automatically append the `scope`, which is cumbersome and verbose to repeat in each Server
    // Action that needs to do authentication. Compound permissions are not supported for now.
    if (permission) {
        if (typeof permission === 'string') {
            accessCheckPermission = {
                permission: permission as BooleanPermission,
                scope: { event: event.slug },
            };
        } else {
            accessCheckPermission = {
                ...permission,
                scope: { event: event.slug },
            } as PermissionAccessCheck;
        }
    }

    executeAccessCheck(authenticationContext, {
        check: 'admin-event',
        event: event.slug,
        permission: accessCheckPermission,
    });

    return { event };
}
