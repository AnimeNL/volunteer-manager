// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden, notFound } from 'next/navigation';

import type { AccessScope } from '@lib/auth/AccessControl';
import type { CachedEvent } from '@lib/cache';
import type { PermissionAccessCheck, PermissionSet, UserAuthenticationContext }
    from '@lib/auth/AuthenticationContext';
import { getEvent } from '@lib/cache';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

/**
 * Type representing an event identifier (either numeric database ID or string slug).
 */
type EventIdentifier = number | string;

/**
 * Page or layout props containing an event parameter.
 */
type EventProps = { params: Promise<{ event: string; [key: string]: any }> };

/**
 * Data returned by the `requireAuthentication` method.
 */
export interface UserAuthenticationContextWithEvent extends UserAuthenticationContext {
    /**
     * Information about the event that's contextual to the current request.
     */
    event: CachedEvent;
}

/**
 * Authenticates the user and verifies access to the current event. Can be called with page or
 * layout `props`, or with an event slug or ID.
 *
 * @example requireAuthentication(eventSlug)
 * @example requireAuthentication(eventSlug, 'event.help-requests')
 * @example requireAuthentication(props)
 * @example requireAuthentication(props, 'event.help-requests')
 * @example requireAuthentication(props, 'event.help-requests', { team: 'stewards' })
 */
export async function requireAuthentication(
    propsOrEvent: EventProps | EventIdentifier,
    permission?: PermissionAccessCheck | PermissionSet,
    scope?: AccessScope): Promise<UserAuthenticationContextWithEvent>
{
    let eventIdentifier: EventIdentifier;
    if (isPropsWithParams(propsOrEvent)) {
        const params = await propsOrEvent.params;
        eventIdentifier = params.event;
    } else {
        eventIdentifier = propsOrEvent;
    }

    const event = await getEvent(eventIdentifier);
    if (!event)
        notFound();

    const actualScope: AccessScope = {
        event: event.slug,
        ...scope,
    };

    const context = await requireAuthenticationContext(permission, actualScope);
    if (!context.access.can('event.schedule.access', { event: event.slug })) {
        if (!context.events.has(event.slug))
            forbidden();
    }

    return { ...context, event };
}

/**
 * Determines whether the `candidate` is a props object containing `params`.
 */
function isPropsWithParams(candidate: unknown): candidate is EventProps {
    return !!candidate && typeof candidate === 'object' && 'params' in candidate;
}
