// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';
import type { cookies } from 'next/headers';

import { requireSealingSecret, sealToken, unsealToken } from './SealedToken';

import { kSecureCookie } from './Constants';

/**
 * Name of the short-lived cookie carrying a sealed WebAuthn challenge.
 */
const kPasskeyChallengeCookieName = 'passkey_challenge';

/**
 * Maximum lifetime of a WebAuthn challenge, in seconds (5 minutes).
 */
const kPasskeyChallengeTtlSeconds = 5 * 60;

/**
 * Secret used to seal passkey challenges. Cryptographically isolated from session cookies via
 * SealedToken's per-purpose HKDF key derivation and AAD.
 */
const kPasskeyChallengePassword = requireSealingSecret('APP_COOKIE_PASSWORD');

/**
 * Payload bound to a single WebAuthn ceremony in a sealed cookie.
 */
interface PasskeyChallengePayload {
    challenge: string;
    flow: 'authenticate' | 'register';
    rpId: string;
    userId: number;
}

type CookieStore = Awaited<ReturnType<typeof cookies>>;

/**
 * Seals a WebAuthn challenge into a short-lived `HttpOnly` cookie on `cookieStore`.
 */
export function writePasskeyChallengeCookie(
    cookieStore: CookieStore, payload: PasskeyChallengePayload): void
{
    const sealed = sealToken(
        payload, 'passkey-challenge', kPasskeyChallengePassword, kPasskeyChallengeTtlSeconds);

    cookieStore.set(kPasskeyChallengeCookieName, sealed, {
        httpOnly: true,
        maxAge: kPasskeyChallengeTtlSeconds,
        path: '/',
        sameSite: 'lax',
        secure: kSecureCookie,
    });
}

/**
 * Reads, clears (single-use), and validates a sealed WebAuthn challenge cookie against the
 * expected `flow`, `rpId`, and `userId`. Returns the expected challenge string, or `undefined` if
 * missing, expired, tampered, or bound to a different ceremony.
 */
export function consumePasskeyChallengeCookie(
    cookieStore: CookieStore,
    expected: Omit<PasskeyChallengePayload, 'challenge'>): string | undefined
{
    const cookie = cookieStore.get(kPasskeyChallengeCookieName);
    if (!cookie?.value)
        return undefined;

    cookieStore.set(kPasskeyChallengeCookieName, '', {
        httpOnly: true,
        maxAge: 0,
        path: '/',
        sameSite: 'lax',
        secure: kSecureCookie,
    });

    try {
        const payload = unsealToken<PasskeyChallengePayload>(
            cookie.value, 'passkey-challenge', kPasskeyChallengePassword);

        if (payload.flow !== expected.flow ||
            payload.rpId !== expected.rpId ||
            payload.userId !== expected.userId ||
            typeof payload.challenge !== 'string' ||
            !payload.challenge.length)
        {
            return undefined;
        }

        return payload.challenge;
    } catch {
        return undefined;
    }
}
