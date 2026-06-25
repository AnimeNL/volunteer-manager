// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { cookies } from 'next/headers';
import { parseCookie } from 'cookie';

import { type SessionData, kSessionCookieName, unsealSession } from './Session';

/**
 * Returns the unsealed Session that was included in the cookies included in the HTTP request, or
 * undefined in case they don't have a (valid) session.
 *
 * @returns SessionData when the session is valid and exists, or undefined otherwise.
 */
export async function getSessionFromCookieStore(cookieStore: ReturnType<typeof cookies>)
    : Promise<SessionData | undefined>
{
    const sessionCookie = (await cookieStore).get(kSessionCookieName);
    if (sessionCookie)
        return getSession(sessionCookie.value);

    return undefined;
}

/**
 * Returns the unsealed Session that was included in the given `headers`, included in the HTTP
 * request, or undefined in case they don't have a (valid) session.
 *
 * @param headers The HTTP headers that were included with the request.
 * @returns SessionData when the session is valid and exists, or undefined otherwise.
 */
export async function getSessionFromHeaders(headers: Headers): Promise<SessionData | undefined> {
    const cookieHeader = headers.get('Cookie');
    if (cookieHeader) {
        const cookies = parseCookie(cookieHeader);

        const sessionCookie = cookies[kSessionCookieName];
        if (sessionCookie)
            return getSession(sessionCookie);
    }

    return undefined;
}

/**
 * Returns the unsealed Session that was included in the given `cookie`, included in the HTTP
 * request, or undefined in case they don't have a (valid) session.
 *
 * @param sessionCookie The session cookie that should be decrypted.
 * @returns SessionData when the session is valid and exists, or undefined otherwise.
 */
async function getSession(sessionCookie: string): Promise<SessionData | undefined> {
    try {
        return await unsealSession(sessionCookie);
    } catch { /* TODO: remove the cookie once I figure out how to */ }

    return undefined;
}
