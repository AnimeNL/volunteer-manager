// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { cache } from 'react';
import { forbidden, unauthorized } from 'next/navigation';

import type { AccessOperation } from '@lib/auth/AccessDescriptor';
import type { BooleanPermission, CRUDPermission } from '@lib/auth/Access';
import type { SessionData } from './Session';

import { AccessControl, kAnyEvent, kAnyTeam, type AccessScope } from './AccessControl';
import { authenticateUser } from './Authentication';
import { getSessionFromCookieStore, getSessionFromHeaders } from './getSession';

// https://github.com/vercel/next.js/discussions/44270
const headers = import('next/headers');

import type {
    AuthenticationContext,
    UserAuthenticationContext,
    VisitorAuthenticationContext,
} from './AuthenticationContextTypes';

export type {
    AuthenticationContext,
    UserAuthenticationContext,
    VisitorAuthenticationContext,
};

/**
 * Determines the authentication context from the cookies included with the current request. May
 * only be used by server-side components, as authentication requires a database query.
 */
export const getAuthenticationContext = cache(async (): Promise<AuthenticationContext> => {
    const sessionData = await getSessionFromCookieStore((await headers).cookies());
    if (sessionData)
        return getAuthenticationContextFromSessionData(sessionData);

    return {
        access: new AccessControl({ /* no grants */ }),
        user: /* guest= */ undefined,
    };
});

/**
 * Determines the authentication context based on the given `headers`. May only be used by server-
 * side components, as authentication requires a fdatabase query.
 */
export async function getAuthenticationContextFromHeaders(headers: Headers)
    : Promise<AuthenticationContext>
{
    const sessionData = await getSessionFromHeaders(headers);
    if (sessionData)
        return getAuthenticationContextFromSessionData(sessionData);

    return {
        access: new AccessControl({ /* no grants */ }),
        user: /* guest= */ undefined,
    }
}

/**
 * Definition for a permission-based access check.
 */
export type PermissionAccessCheck =
    BooleanPermission |
    {
        permission: BooleanPermission;
        scope?: AccessScope;
    } |
    {
        permission: CRUDPermission;
        operation: AccessOperation;
        scope?: AccessScope;
    };

/**
 * A set of permissions that should be checked in a particular manner.
 */
export type PermissionSet = { type: 'and' | 'or', checks: PermissionAccessCheck[] };

export function and(...permissions: PermissionAccessCheck[]): PermissionSet {
    return { type: 'and', checks: permissions };
}

export function or(...permissions: PermissionAccessCheck[]): PermissionSet {
    return { type: 'or', checks: permissions };
}

/**
 * Types of access check that can be executed. Each check should be individually documented.
 */
type AuthenticationAccessCheckTypes =
    /**
     * Access to the administrative area. This is the case when either:
     *   (1) The user has permission to any event,
     *   (2) The user has admin access because of an active event.
     */
    { check: 'admin' } |

    /**
     * Access to the administrative area for a particular event. This is the case when either:
     *   (1) The user has permission to access any event,
     *   (2) The user has admin access to the given `event`, which must be a slug.
     *   (3) Optionally, the user has admin access to the given `team`, which must be a slug.
     */
    { check: 'admin-event', event: string, team?: string } |

    /**
     * Access to the schedule for a particular event. This is the case when either:
     *   (1) The user has permission to access any event,
     *   (2) The user has admin access to the given `event`, which must be active,
     *   (3) The event's schedule has been published by an event administrator.
     */
    { check: 'event', event: string } |

    /**
     * Access checks may be omitted in favour of only checking for permissions.
     */
    { };

/**
 * The access check always allows for permissions to be checked inline.
 */
type AuthenticationAccessCheck = AuthenticationAccessCheckTypes & {
    permission?: PermissionAccessCheck | PermissionSet;
};

/**
 * Executes a permission `check` on the given `access` object.
 */
function checkIndividualPermission(access: AccessControl, check: PermissionAccessCheck): boolean {
    if (typeof check === 'string')
        return access.can(check as BooleanPermission);

    if ('operation' in check) {
        const permission = check.permission as CRUDPermission;
        if (access.can(permission, check.operation, check.scope))
            return true;  // permission has been granted

    } else {
        const permission = check.permission as BooleanPermission;
        if (access.can(permission, check.scope))
            return true;  // permission has been granted
    }

    return false;
}

/**
 * Executes a permission `check` on the given `access` object, which may also be a set of checks
 * that should be executed with a particular result in mind.
 */
export function checkPermission(
    access: AccessControl, permission: PermissionAccessCheck | PermissionSet): boolean
{
    if (typeof permission !== 'string' && 'type' in permission) {
        let count = 0;
        for (const individualPermission of permission.checks)
            count += checkIndividualPermission(access, individualPermission) ? 1 : 0;

        return permission.type === 'and' ? /* && */ count === permission.checks.length
                                         : /* || */ count > 0;
    }

    return checkIndividualPermission(access, permission);
}

/**
 * Executes the given `access` check. The `type` determines what should be checked for, optionally
 * with additional parameters, and permissions can always be checked for. A HTTP 401 Unauthorized or
 * HTTP 403 Forbidden error will be thrown when the access check fails.
 *
 * @note Access checks can be done inline when requiring an authentication context to exist.
 */
export function executeAccessCheck(
    context: AuthenticationContext, access: AuthenticationAccessCheck): void | never
{
    if (access.permission && !checkPermission(context.access, access.permission)) {
        !!context.user ? forbidden()
                       : unauthorized();
    }

    if ('check' in access) {
        if (!context.user)
            unauthorized();

        switch (access.check) {
            case 'admin':
                context.access.require('event.visible', {
                    event: kAnyEvent,
                    team: kAnyTeam,
                });

                break;

            case 'admin-event':
                context.access.require('event.visible', {
                    event: access.event,
                    team: access.team ?? kAnyTeam
                });

                break;

            case 'event':
                if (!context.access.can('event.schedule.access', { event: access.event })) {
                    if (!context.events.has(access.event))
                        forbidden();
                }
                break;
        }
    }
}

/**
 * Determines the authentication context from the cookies included with the current request, and
 * will issue a HTTP 404 Not Found error when none could be loaded. May only be used by server-side
 * components, as authentication requires a database query.
 */
export async function requireAuthenticationContext(access?: AuthenticationAccessCheck)
    : Promise<UserAuthenticationContext>
{
    const authenticationContext = await getAuthenticationContext();
    if (!authenticationContext.user)
        unauthorized();

    if (access)
        executeAccessCheck(authenticationContext, access);

    return authenticationContext;
}

/**
 * Actually gets the authentication context from the given `sessionData`.
 */
async function getAuthenticationContextFromSessionData(sessionData: SessionData)
    : Promise<AuthenticationContext>
{
    return authenticateUser({ type: 'session', ...sessionData });
}
