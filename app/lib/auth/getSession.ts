// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { cookies } from 'next/headers';

import { type SessionData, kSessionCookieName, unsealSession } from './Session';

type CookieStoreLike = ReturnType<typeof cookies> | Awaited<ReturnType<typeof cookies>>;

/**
 * Returns the unsealed Session that was included in the cookies included in the HTTP request, or
 * undefined in case they don't have a (valid) session.
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
