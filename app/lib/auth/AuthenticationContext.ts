// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { unauthorized } from 'next/navigation';

import type { Grant } from './access/AccessList';
import type { AuthenticationContext, UserAuthenticationContext }
    from './AuthenticationContextTypes';
import type { PermissionAccessCheck, PermissionSet } from './access/PermissionCheck';
import type { SessionData } from './Session';
import type { User } from './User';
import { AccessControl } from './access/AccessControl';
import { Cache } from '@lib/cache';
import { createAndWriteUserSessionCookie, hashSessionSecret, revokeUserSession,
    timingSafeEqualHex, touchUserSession, verifyUserSession } from './SessionStore';
import { executeAccessCheck } from './access/PermissionCheck';
import { getBlobUrl } from '../database/BlobStore';
import { getSessionFromCookieStore } from './Session';
import { initialisePermissionRoles } from './access/PermissionRoles';
import { normalizeClientIp } from './RateLimit';
import db, { tEvents, tRoles, tStorage, tTeams, tUsers, tUsersEvents } from '../database';

import { kRegistrationStatus } from '../database/Types';

/**
 * Row shape returned by the user authentication query in `loadUserAuthenticationContext()`.
 * Exported for test helpers that mock the query.
 */
export interface AuthenticationResult {
    // AuthenticationContext.accessControl:
    accessControl?: {
        grants?: string;
        revokes?: string;
        events?: string;
        teams?: string;
    };

    // UserAuthenticationContext.events:
    events?: {
        event: string;
        grant?: string;
        team: string;
    }[];

    // UserAuthenticationContext.user:
    userId: number;
    username?: string;
    name: string;
    firstName: string;
    lastName: string;
    displayName?: string;
    avatarFileHash?: string;
}

/**
 * Loads the `AuthenticationContext` for the user identified by `userId` from the database. Returns
 * a visitor (guest) context when the user does not exist, is not activated, or is anonymized.
 */
async function loadUserAuthenticationContext(userId: number): Promise<AuthenticationContext> {
    if (!Cache.getInstance('PermissionRoles').has('root'))
        await initialisePermissionRoles();

    const storageJoin = tStorage.forUseInLeftJoin();

    const dbInstance = db;
    const eventsSubSelect = dbInstance.subSelectUsing(tUsers)
        .from(tUsersEvents)
        .innerJoin(tEvents)
            .on(tEvents.eventId.equals(tUsersEvents.eventId))
                .and(tEvents.eventHidden.equals(/* false= */ 0))
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tUsersEvents.teamId))
                .and(tTeams.teamDeleted.isNull())
        .innerJoin(tRoles)
            .on(tRoles.roleId.equals(tUsersEvents.roleId))
        .where(tUsersEvents.userId.equals(tUsers.userId))
            .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
        .select({
            event: tEvents.eventSlug,
            grant: tRoles.rolePermissionGrant,
            team: tTeams.teamSlug,
        })
        .forUseAsInlineAggregatedArrayValue();

    const authenticationResult = await dbInstance.selectFrom(tUsers)
        .leftJoin(storageJoin)
            .on(storageJoin.fileId.equals(tUsers.avatarId))
        .where(tUsers.userId.equals(userId))
            .and(tUsers.activated.equals(/* true= */ 1))
            .and(tUsers.anonymized.isNull())
        .select({
            // AuthenticationContext.accessControl:
            accessControl: {
                grants: tUsers.permissionsGrants,
                revokes: tUsers.permissionsRevokes,
                events: tUsers.permissionsEvents,
                teams: tUsers.permissionsTeams,
            },

            // UserAuthenticationContext.events:
            events: eventsSubSelect,

            // UserAuthenticationContext.user:
            userId: tUsers.userId,
            username: tUsers.username,
            name: tUsers.name,
            firstName: tUsers.firstName,
            lastName: tUsers.lastName,
            displayName: tUsers.displayName,
            avatarFileHash: storageJoin.fileHash,
        })
        .executeSelectNoneOrOne();

    if (!authenticationResult) {
        return {
            access: new AccessControl({ /* no grants */ }),
            user: /* guest= */ undefined,
        };
    }

    const events = new Map<string, Set<string>>();
    const user: User = {
        id: authenticationResult.userId,
        username: authenticationResult.username,
        name: authenticationResult.name,
        nameOrFirstName: authenticationResult.displayName || authenticationResult.firstName,
        firstName: authenticationResult.firstName,
        lastName: authenticationResult.lastName,
        displayName: authenticationResult.displayName,
        avatarUrl:
            authenticationResult.avatarFileHash ? getBlobUrl(authenticationResult.avatarFileHash)
                                                : undefined,
    };

    const grants: Grant[] = [ /* no grants */ ];

    if (!!authenticationResult.accessControl?.grants)
        grants.push(authenticationResult.accessControl.grants);

    for (const entry of authenticationResult.events ?? []) {
        if (!!entry.grant) {
            grants.push({
                permission: entry.grant,
                event: entry.event,
                team: entry.team,
            });
        }

        let eventTeams = events.get(entry.event);
        if (!eventTeams) {
            eventTeams = new Set();
            events.set(entry.event, eventTeams);
        }

        eventTeams.add(entry.team);
    }

    const accessControl = new AccessControl({
        grants,
        revokes: authenticationResult.accessControl?.revokes,
        events: authenticationResult.accessControl?.events,
        teams: authenticationResult.accessControl?.teams,
    });

    return { access: accessControl, events, user };
}

/**
 * Invalidates cached authentication context(s). Pass `forUserId` when a single user's profile,
 * permissions, event participations, activation status, or session changes; omit it to clear all
 * cached contexts when global authorization inputs (roles, event visibility) change.
 */
export function invalidateAuthCache(forUserId?: number): void {
    const authCache = Cache.getInstance('Authentication');
    if (forUserId !== undefined)
        authCache.delete(forUserId);
    else
        authCache.clear();
}

/**
 * Options accepted by `requireAuthenticationContext()`.
 */
interface RequireAuthenticationOptions {
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
    options?: RequireAuthenticationOptions): Promise<UserAuthenticationContext>
{
    const authenticationContext = options?.bypassCache
        ? await loadAuthenticationContext(/* bypassCache= */ true)
        : await getAuthenticationContext();

    if (!authenticationContext.user)
        unauthorized();

    if (permission)
        executeAccessCheck(authenticationContext, permission);

    return authenticationContext;
}

/**
 * Resolves a server-backed per-device session from `users_sessions`, consulting the server-side
 * `Authentication` cache unless `bypassCache` is true.
 */
async function getAuthenticationContextFromSessionData(
    sessionData: SessionData, bypassCache = false): Promise<AuthenticationContext>
{
    if (!Cache.getInstance('PermissionRoles').has('root'))
        await initialisePermissionRoles();

    const authCache = Cache.getInstance('Authentication');
    const secretHash = hashSessionSecret(sessionData.secret);
    const cached = authCache.get(sessionData.userId);

    if (!bypassCache && cached) {
        const cachedHash = cached.sessions.get(sessionData.sessionId);
        if (cachedHash && timingSafeEqualHex(cachedHash, secretHash))
            return cached.context;
    }

    const verified = await verifyUserSession(sessionData.sessionId, sessionData.secret);
    if (!verified || verified.userId !== sessionData.userId) {
        if (bypassCache && cached?.sessions.has(sessionData.sessionId))
            authCache.delete(sessionData.userId);

        return { access: new AccessControl({ /* no grants */ }), user: undefined };
    }

    const context = await loadUserAuthenticationContext(verified.userId);
    if (!context.user) {
        authCache.delete(sessionData.userId);
        return context;
    }

    try {
        await touchUserSession(verified.sessionId);
    } catch { /* non-fatal: session_last_seen is best-effort audit metadata */ }

    const sessions = !bypassCache && cached
        ? new Map(cached.sessions)
        : new Map<number, string>();

    sessions.set(verified.sessionId, secretHash);
    authCache.set(verified.userId, { context, sessions });

    return context;
}

/**
 * Resolves the `AuthenticationContext` for the current request from Next.js cookies.
 */
async function loadAuthenticationContext(bypassCache: boolean): Promise<AuthenticationContext> {
    const sessionData = await getSessionFromCookieStore(cookies());
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
 * Options for `impersonateUser()`.
 */
interface ImpersonateUserOptions {
    impersonatorUserId: number;
    returnUrl: string;
    ip?: string;
}

/**
 * Signs the current request into the account identified by `userId` as an impersonation session,
 * writing the session cookie. Returns the impersonated `User`, or `undefined` if the target account
 * does not exist, matches the impersonator, is requested from an existing impersonation session, or
 * cannot be signed into.
 */
export async function impersonateUser(
    userId: number, options: ImpersonateUserOptions): Promise<User | undefined>
{
    if (userId === options.impersonatorUserId)
        return undefined;

    const cookieStore = await cookies();
    const previousSession = await getSessionFromCookieStore(cookieStore);
    const verifiedPrevious = previousSession
        ? await verifyUserSession(previousSession.sessionId, previousSession.secret)
        : undefined;

    if (!verifiedPrevious ||
        verifiedPrevious.userId !== options.impersonatorUserId ||
        verifiedPrevious.impersonatorUserId !== undefined)
    {
        return undefined;
    }

    const { user: impersonatedUser } = await loadUserAuthenticationContext(userId);

    if (!impersonatedUser)
        return undefined;

    const revoked = await revokeUserSession(verifiedPrevious.sessionId, verifiedPrevious.userId);
    if (!revoked)
        return undefined;

    const requestHeaders = await headers();
    const rawIp = options.ip?.trim() || requestHeaders.get('x-forwarded-for')?.trim();
    const normalizedIp = rawIp ? normalizeClientIp(rawIp) : undefined;
    const ip = normalizedIp && normalizedIp !== 'unknown' ? normalizedIp : undefined;

    await createAndWriteUserSessionCookie(cookieStore, {
        userId: impersonatedUser.id,
        impersonatorUserId: options.impersonatorUserId,
        impersonatorReturnUrl: options.returnUrl,
        ip,
        userAgent: requestHeaders.get('user-agent') ?? undefined,
    }, { revokeExisting: false });

    return impersonatedUser;
}
