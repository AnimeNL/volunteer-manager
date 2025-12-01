// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { seal, unseal } from './Iron';
import { serialize } from 'cookie';

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
 * Number of seconds after which the authentication cookie should expire. Currently set to half a
 * year to make sure people sign in again at least once per conference.
 */
export const kSessionExpirationTimeSeconds = 180 * 24 * 60 * 60;

/**
 * The data that will be stored in the cookie. This data will be send to the server during every
 * HTTP request, which means that we should attempt to keep it as light as possible.
 */
export interface SessionData {
    /**
     * Unique ID of the user who is currently signed in to this account.
     */
    id: number;

    /**
     * Session token for the user. This is used to allow users to invalidate all remote sessions in
     * case they believe their account has been compromised.
     */
    token: number;

    /**
     * Session data can optionally be nested. When signing out such a user, the nested session data
     * will be restored instead. Optionally a return URL may be specified as well.
     */
    parent?: SessionData & { returnUrl?: string; };
}

/**
 * Seals the given |session| in a format that can safely be shared with users without expecting them
 * to be able to tamper with the data.
 *
 * @param request The plaintext session data in its original format.
 * @returns The sealed session data, as a string.
 */
export async function sealSession(session: SessionData): Promise<string> {
    return await seal(session, kSessionPassword, kSessionExpirationTimeSeconds);
}

/**
 * Unseals the given |sealedSession| back to its original format. An exception will be thrown when
 * the data cannot be unsealed successfully.
 *
 * @param sealedSession The sealed session data to unseal, as a string.
 * @returns The plaintext session data in its original format.
 */
export async function unsealSession(sealedSession: string): Promise<SessionData> {
    return await unseal(sealedSession, kSessionPassword) as SessionData;
}

/**
 * Writes an empty session cookie to the given `headers`.
 */
export async function writeEmptySessionCookie(headers: Headers): Promise<void> {
    headers.append('Set-Cookie', serialize(kSessionCookieName, '', {
        httpOnly: true,
        maxAge: 0,
        path: '/',
    }));
}

/**
 * Writes the given `session` in sealed format to the given `headers`.
 */
export async function writeSealedSessionCookie(session: SessionData, headers: Headers)
    : Promise<void>
{
    headers.append('Set-Cookie', serialize(kSessionCookieName, await sealSession(session), {
        httpOnly: true,
        maxAge: kSessionExpirationTimeSeconds,
        path: '/',
    }));
}

/**
 * Writes the given `session` in sealed format to the given `cookieStore`.
 */
export async function writeSealedSessionCookieToStore(session: SessionData, cookieStore: any)
    : Promise<void>
{
    cookieStore.set(kSessionCookieName, await sealSession(session), {
        httpOnly: true,
        maxAge: kSessionExpirationTimeSeconds,
        path: '/',
    });
}
