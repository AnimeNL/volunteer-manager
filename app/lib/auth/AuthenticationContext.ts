// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { cache } from 'react';
import { forbidden, unauthorized } from 'next/navigation';

// https://github.com/vercel/next.js/discussions/44270
const headers = import('next/headers');

import type { AccessOperation } from '@lib/auth/AccessDescriptor';
import type { BooleanPermission, CRUDPermission } from '@lib/auth/Access';
import type { SessionData } from './Session';

import { AccessControl, type AccessScope } from './AccessControl';
import { authenticateUser } from './Authentication';
import { getSessionFromCookieStore, getSessionFromHeaders } from './getSession';

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
 * Access check for a specific permission. May be a simple boolean permission, or a CRUD permission
 * which requires a specific operation to be allowed.
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
 * A set of permission checks, either where all ("and") or any ("or") of the checks must pass.
 */
export type PermissionSet = {
    type: 'and' | 'or';
    checks: PermissionAccessCheck[];
};

export function and(...permissions: PermissionAccessCheck[]): PermissionSet {
    return { type: 'and', checks: permissions };
}

export function or(...permissions: PermissionAccessCheck[]): PermissionSet {
    return { type: 'or', checks: permissions };
}

/**
 * Executes a permission `check` on the given `access` object.
 */
function checkIndividualPermission(
    access: AccessControl, check: PermissionAccessCheck, scope?: AccessScope): boolean
{
    if (typeof check === 'string')
        return access.can(check as BooleanPermission, scope);

    if ('operation' in check) {
        const permission = check.permission as CRUDPermission;
        if (access.can(permission, check.operation, check.scope ?? scope))
            return true;  // permission has been granted

    } else {
        const permission = check.permission as BooleanPermission;
        if (access.can(permission, check.scope ?? scope))
            return true;  // permission has been granted
    }

    return false;
}

/**
 * Executes a permission `check` on the given `access` object, which may also be a set of checks
 * that should be executed with a particular result in mind.
 */
export function checkPermission(
    access: AccessControl, permission: PermissionAccessCheck | PermissionSet, scope?: AccessScope)
        : boolean
{
    if (typeof permission !== 'string' && 'type' in permission) {
        let count = 0;
        for (const individualPermission of permission.checks)
            count += checkIndividualPermission(access, individualPermission, scope) ? 1 : 0;

        return permission.type === 'and' ? /* && */ count === permission.checks.length
                                         : /* || */ count > 0;
    }

    return checkIndividualPermission(access, permission, scope);
}

/**
 * Executes the given `permission` check. A HTTP 401 Unauthorized or HTTP 403 Forbidden error will
 * be thrown when the access check fails.
 *
 * @note Access checks can be done inline when requiring an authentication context to exist.
 */
export function executeAccessCheck(
    context: AuthenticationContext,
    permission: PermissionAccessCheck | PermissionSet,
    scope?: AccessScope): void | never
{
    if (!checkPermission(context.access, permission, scope)) {
        !!context.user ? forbidden()
                       : unauthorized();
    }
}

/**
 * Determines the authentication context from the cookies included with the current request, and
 * will issue a HTTP 401 Unauthorized error when none could be loaded. May only be used by
 * server-side components, as authentication requires a database query.
 */
export async function requireAuthenticationContext(
    permission?: PermissionAccessCheck | PermissionSet,
    scope?: AccessScope): Promise<UserAuthenticationContext>
{
    const authenticationContext = await getAuthenticationContext();
    if (!authenticationContext.user)
        unauthorized();

    if (permission)
        executeAccessCheck(authenticationContext, permission, scope);

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

/**
 * Determines the authentication context based on the request headers. Only for use in tests.
 *
 * @param headers The Headers object from the request.
 */
export async function getAuthenticationContextFromHeaders(
    headers: Headers): Promise<AuthenticationContext>
{
    const sessionData = await getSessionFromHeaders(headers);
    if (!sessionData)
        return { access: new AccessControl({}), user: undefined };

    return getAuthenticationContextFromSessionData(sessionData);
}

/**
 * Returns the `AuthenticationContext` for the current user. May return a context for a visitor, who
 * does not have any privileges assigned to them.
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
