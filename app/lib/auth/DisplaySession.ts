// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';
import { cookies } from 'next/headers';

import { sealToken, unsealToken } from './SealedToken';

import { kSecureCookie } from './Constants';

/**
 * The password through which the display session will be sealed. A start-up exception will be
 * thrown when this value is not available, as we would not be able to provide security.
 */
const kDisplaySessionPassword = process.env.APP_COOKIE_PASSWORD!;
if (!kDisplaySessionPassword || !kDisplaySessionPassword.length)
    throw new Error('Unable to start the Volunteer Manager without a set APP_COOKIE_PASSWORD');

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
async function sealDisplaySession(session: { id: number }): Promise<string> {
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
async function unsealDisplaySession(sealedSession: string): Promise<{ id: number }> {
    return unsealToken<{ id: number }>(sealedSession, 'display', kDisplaySessionPassword);
}

/**
 * Returns the unsealed display ID from the current request's cookies, or `undefined` when missing
 * or invalid.
 */
export async function getDisplayId(): Promise<number | undefined> {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(kDisplaySessionCookieName);
    if (sessionCookie) {
        try {
            return (await unsealDisplaySession(sessionCookie.value)).id;
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
    cookieStore.set(kDisplaySessionCookieName, await sealDisplaySession({ id: displayId }), {
        httpOnly: true,
        maxAge: kDisplaySessionExpirationTimeSeconds,
        path: '/',
        sameSite: 'lax',
        secure: kSecureCookie,
    });
}
