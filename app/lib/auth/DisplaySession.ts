// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';
import { cookies } from 'next/headers';
import { io } from 'next/cache';

import { buildCookieOptions } from './Constants';
import { requireSealingSecret, sealToken, unsealToken } from './SealedToken';

/**
 * The password through which the display session will be sealed. Validated at module start-up.
 */
const kDisplaySessionPassword = requireSealingSecret('APP_COOKIE_PASSWORD');

/**
 * Name of the cookie in which display session data will be stored.
 */
const kDisplaySessionCookieName = 'display';

/**
 * Number of seconds after which the authentication cookie should expire. Set to 399 days, which is
 * just below the recommended maximum value of 400 days indicated in RFC 6265.
 */
const kDisplaySessionExpirationTimeSeconds = 399 * 24 * 60 * 60;

/**
 * Seals the given |session| in a format that can safely be shared with a display without expecting
 * the data to be tampered with.
 *
 * @param session The plaintext session data in its original format.
 * @returns The sealed session data, as a string.
 */
function sealDisplaySession(session: { id: number }): string {
    return sealToken(
        session, 'display', kDisplaySessionPassword, kDisplaySessionExpirationTimeSeconds);
}

/**
 * Unseals the given |sealedSession| back to its original format. An exception will be thrown when
 * the data cannot be unsealed successfully.
 *
 * @param sealedSession The sealed session data to unseal, as a string.
 * @returns The plaintext session data in its original format.
 */
function unsealDisplaySession(sealedSession: string): { id: number } {
    const data = unsealToken<{ id: number }>(sealedSession, 'display', kDisplaySessionPassword);
    if (typeof data?.id !== 'number')
        throw new Error('Invalid display session payload');

    return data;
}

/**
 * Returns the unsealed display ID from the current request's cookies, or `undefined` when missing
 * or invalid.
 */
export async function getDisplayId(): Promise<number | undefined> {
    await io();

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(kDisplaySessionCookieName);
    if (sessionCookie) {
        try {
            return unsealDisplaySession(sessionCookie.value).id;
        } catch {
            console.error('Invalid display session cookie, discarded');
        }
    }

    return undefined;
}

/**
 * Writes the given `displayId` as an encrypted `HttpOnly` cookie on the current response.
 */
export async function setDisplayId(displayId: number): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.set(
        kDisplaySessionCookieName,
        sealDisplaySession({ id: displayId }),
        buildCookieOptions(kDisplaySessionExpirationTimeSeconds));
}
