// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import crypto from 'node:crypto';
import { cache } from 'react';
import { forbidden, unauthorized } from 'next/navigation';

// https://github.com/vercel/next.js/discussions/44270
const headers = import('next/headers');

import type { AccessOperation } from '@lib/auth/AccessDescriptor';
import type { BooleanPermission, CRUDPermission } from '@lib/auth/Access';
import type { LegacySessionData, PersistentSessionData, SessionData } from './Session';

import { AccessControl, type AccessScope } from './AccessControl';
import { Cache } from '@lib/cache';
import { authenticateUser } from './Authentication';
import { getSessionFromCookieStore, getSessionFromHeaders } from './getSession';
import { hashSessionSecret, touchUserSession, verifyUserSession } from './SessionStore';
import { isPersistentSessionData } from './Session';
import db, { tPermissionsRoles } from '@lib/database';

import { kPermissionGroups } from './Access';

import type {
    AuthenticationContext,
    UserAuthenticationContext,
} from './AuthenticationContextTypes';

export type {
    AuthenticationContext,
    UserAuthenticationContext,
};

declare namespace globalThis {
    let animeConRolesInitialised: boolean | undefined;
}

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
 * Invalidates any cached authentication context for the user identified by `userId`. Call this
 * whenever a user's profile, permissions, event participations, activation status, or session
 * token changes.
 */
export function invalidateUserAuthCache(userId: number): void {
    Cache.getInstance('Authentication').delete(userId);
}

/**
 * Clears all cached authentication contexts. Call this when global authorization inputs change,
 * such as permission role definitions, role permission grants, or event visibility.
 */
export function clearAuthCache(): void {
    Cache.getInstance('Authentication').clear();
}

/**
 * Options accepted by `requireAuthenticationContext()`.
 */
export interface RequireAuthenticationOptions {
    /**
     * When true, bypasses the server-side `Authentication` cache and verifies the session directly
     * against the database. Use for high-risk security mutations.
     */
    bypassCache?: boolean;
}

/**
 * Determines the authentication context from the cookies included with the current request, and
 * will issue a HTTP 401 Unauthorized error when none could be loaded. May only be used by
 * server-side components, as authentication requires a database query.
 */
export async function requireAuthenticationContext(
    permission?: PermissionAccessCheck | PermissionSet,
    scope?: AccessScope,
    options?: RequireAuthenticationOptions): Promise<UserAuthenticationContext>
{
    const authenticationContext = options?.bypassCache
        ? await loadAuthenticationContext(/* bypassCache= */ true)
        : await getAuthenticationContext();

    if (!authenticationContext.user)
        unauthorized();

    if (permission)
        executeAccessCheck(authenticationContext, permission, scope);

    return authenticationContext;
}

/**
 * Compares two hex-encoded digests in constant time.
 */
function timingSafeEqualHex(a: string, b: string): boolean {
    const bufferA = Buffer.from(a, 'hex');
    const bufferB = Buffer.from(b, 'hex');
    return bufferA.length === bufferB.length && crypto.timingSafeEqual(bufferA, bufferB);
}

/**
 * Resolves a server-backed per-device session from `users_sessions`, using the `Authentication`
 * cache unless `bypassCache` is true.
 */
async function resolvePersistentSession(
    sessionData: PersistentSessionData, bypassCache: boolean): Promise<AuthenticationContext>
{
    const authCache = Cache.getInstance('Authentication');
    const secretHash = hashSessionSecret(sessionData.secret);
    const cached = authCache.get(sessionData.userId);

    if (!bypassCache && cached?.sessions) {
        const cachedHash = cached.sessions.get(sessionData.sessionId);
        if (cachedHash && timingSafeEqualHex(cachedHash, secretHash))
            return cached.context;
    }

    const verified = await verifyUserSession(sessionData.sessionId, sessionData.secret);
    if (!verified || verified.userId !== sessionData.userId)
        return { access: new AccessControl({ /* no grants */ }), user: undefined };

    const context = await authenticateUser({ type: 'userId', userId: verified.userId });
    if (!context.user)
        return context;

    try {
        await touchUserSession(verified.sessionId);
    } catch { /* non-fatal: session_last_seen is best-effort audit metadata */ }

    const sessions = !bypassCache && cached?.sessions
        ? new Map(cached.sessions)
        : new Map<number, string>();

    sessions.set(verified.sessionId, secretHash);
    authCache.set(verified.userId, {
        context,
        sessionToken: bypassCache ? undefined : cached?.sessionToken,
        sessions,
    });

    return context;
}

/**
 * Resolves a legacy cookie session keyed by `users.session_token`, using the `Authentication` cache
 * unless `bypassCache` is true.
 */
async function resolveLegacySession(
    sessionData: LegacySessionData, bypassCache: boolean): Promise<AuthenticationContext>
{
    const authCache = Cache.getInstance('Authentication');
    const cached = authCache.get(sessionData.id);
    if (!bypassCache && cached && cached.sessionToken === sessionData.token)
        return cached.context;

    const context = await authenticateUser({ type: 'session', ...sessionData });
    if (context.user) {
        authCache.set(sessionData.id, {
            context,
            sessionToken: sessionData.token,
            sessions: bypassCache ? undefined : cached?.sessions,
        });
    }

    return context;
}

/**
 * Actually gets the authentication context from the given `sessionData`, consulting the
 * server-side `Authentication` cache unless `bypassCache` is true.
 */
async function getAuthenticationContextFromSessionData(
    sessionData: SessionData, bypassCache = false): Promise<AuthenticationContext>
{
    await ensurePermissionRolesInitialised();

    return isPersistentSessionData(sessionData)
        ? resolvePersistentSession(sessionData, bypassCache)
        : resolveLegacySession(sessionData, bypassCache);
}

/**
 * Determines the authentication context based on the request headers. Only for use in tests.
 *
 * @param headers The Headers object from the request.
 */
export async function getAuthenticationContextFromHeaders(
    headers: Headers, bypassCache = false): Promise<AuthenticationContext>
{
    const sessionData = await getSessionFromHeaders(headers);
    if (!sessionData)
        return { access: new AccessControl({ /* no grants */ }), user: undefined };

    return getAuthenticationContextFromSessionData(sessionData, bypassCache);
}

/**
 * Resolves the `AuthenticationContext` for the current request from Next.js cookies.
 */
async function loadAuthenticationContext(bypassCache: boolean): Promise<AuthenticationContext> {
    const sessionData = await getSessionFromCookieStore((await headers).cookies());
    if (sessionData)
        return getAuthenticationContextFromSessionData(sessionData, bypassCache);

    return {
        access: new AccessControl({ /* no grants */ }),
        user: /* guest= */ undefined,
    };
}

/**
 * Returns the `AuthenticationContext` for the current user. May return a context for a visitor, who
 * does not have any privileges assigned to them.
 */
export const getAuthenticationContext = cache(async (): Promise<AuthenticationContext> =>
    loadAuthenticationContext(/* bypassCache= */ false));

/**
 * Ability to explicitly set the roles that the system should be initialised with for tests.
 */
type RolesForTesting = { role: string; grants?: string; revokes?: string; }[];

/**
 * Ensures that permission roles have been loaded into the `PermissionRoles` cache at least once.
 */
export async function ensurePermissionRolesInitialised(): Promise<void> {
    if (!globalThis.animeConRolesInitialised)
        await initialisePermissionRoles();
}

/**
 * Provides one-off initialisation of permission roles by fetching them from the database and
 * storing them in the Cache. Any further modifications will be synchronised in the Cache directly.
 */
export async function initialisePermissionRoles(rolesForTesting?: RolesForTesting) {
    const cache = Cache.getInstance('PermissionRoles');
    const roles = rolesForTesting || await db.selectFrom(tPermissionsRoles)
        .select({
            role: tPermissionsRoles.permissionRoleId,
            grants: tPermissionsRoles.permissionRoleGrants,
            revokes: tPermissionsRoles.permissionRoleRevokes,
        })
        .executeSelectMany();

    for (const { role, grants, revokes } of roles) {
        cache.set(role, {
            grants: grants?.split(',') || [ /* no grants */ ],
            revokes: revokes?.split(',') || [ /* no revokes */ ],
        });
    }

    cache.set('root', {
        grants: kPermissionGroups,
        revokes: [ /* no revokes */ ],
    });

    globalThis.animeConRolesInitialised = true;
}
