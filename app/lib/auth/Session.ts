// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { cookies } from 'next/headers';

import { sealToken, unsealToken } from './SealedToken';

import { kSecureCookie, kSessionExpirationTimeSeconds } from './Constants';

type CookieStore = Awaited<ReturnType<typeof cookies>>;
type CookieStoreLike = ReturnType<typeof cookies> | CookieStore;

/**
 * The password through which the session will be sealed. A start-up exception will be thrown when
 * this value is not available, as we would not be able to provide security to our visitors.
 */
const kSessionPassword = process.env.APP_COOKIE_PASSWORD!;
if (!kSessionPassword || !kSessionPassword.length)
    throw new Error('Unable to start the Volunteer Manager without a set APP_COOKIE_PASSWORD');

/**
 * Name of the cookie in which session data will be stored.
 */
export const kSessionCookieName = 'auth';

/**
 * Server-backed per-device session data stored in `users_sessions` and sealed into the auth cookie.
 */
export interface SessionData {
    /**
     * Primary key of the session row in `users_sessions`.
     */
    sessionId: number;

    /**
     * Unique ID of the user who owns this session. Verified against `users_sessions` on cache miss.
     */
    userId: number;

    /**
     * Per-device random secret whose SHA-256 hash is stored in `users_sessions`.
     */
    secret: string;
}

/**
 * Seals the given `session` in a format that can safely be shared with users without expecting them
 * to be able to tamper with the data.
 */
export async function sealSession(session: SessionData): Promise<string> {
    return sealToken(session, 'session', kSessionPassword, kSessionExpirationTimeSeconds);
}

/**
 * Unseals the given `sealedSession` back to its original format. An exception will be thrown when
 * the data cannot be unsealed successfully or does not match the current session shape.
 */
export async function unsealSession(sealedSession: string): Promise<SessionData> {
    const data = unsealToken<Partial<SessionData>>(sealedSession, 'session', kSessionPassword);
    if (!data || typeof data.sessionId !== 'number' || typeof data.userId !== 'number' ||
        typeof data.secret !== 'string' || !data.secret.length)
    {
        throw new Error('Invalid session payload.');
    }

    return {
        sessionId: data.sessionId,
        userId: data.userId,
        secret: data.secret,
    };
}

/**
 * Returns the unsealed session from `cookieStore`, or `undefined` when missing, invalid, or
 * expired.
 */
export async function getSessionFromCookieStore(cookieStore: CookieStoreLike)
    : Promise<SessionData | undefined>
{
    const sessionCookie = (await cookieStore).get(kSessionCookieName);
    if (sessionCookie) {
        try {
            return await unsealSession(sessionCookie.value);
        } catch { /* invalid or expired cookie; treat as signed out */ }
    }

    return undefined;
}

/**
 * Writes an empty session cookie to the given `cookieStore`.
 */
export function writeEmptySessionCookieToStore(cookieStore: CookieStore): void {
    cookieStore.set(kSessionCookieName, '', {
        httpOnly: true,
        maxAge: 0,
        path: '/',
        sameSite: 'lax',
        secure: kSecureCookie,
    });
}

/**
 * Writes the given `session` in sealed format to the given `cookieStore`.
 */
export async function writeSealedSessionCookieToStore(
    session: SessionData, cookieStore: CookieStore): Promise<void>
{
    cookieStore.set(kSessionCookieName, await sealSession(session), {
        httpOnly: true,
        maxAge: kSessionExpirationTimeSeconds,
        path: '/',
        sameSite: 'lax',
        secure: kSecureCookie,
    });
}
