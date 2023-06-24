// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Crypto } from '@peculiar/webcrypto';
import { defaults as ironDefaults, seal, unseal } from 'iron-webcrypto';

import { type SessionData } from './Session';

/**
 * The password through which password reset requests will be sealed. This must be set in the global
 * environment at build time, and is considered sensitive information.
 */
const kPasswordResetRequestPassword = process.env.APP_PASSRESET_PASSWORD;
if (!kPasswordResetRequestPassword || !kPasswordResetRequestPassword.length)
    throw new Error('Unable to start the Volunteer Manager without a set APP_PASSRESET_PASSWORD');

/**
 * Number of seconds that a password reset request is valid for.
 */
export const kPasswordResetRequestExpirySeconds = 86400;  // one day

/**
 * Prefer use of the Web Crypto implementation offered natively (in browsers & NodeJS v19+), fall
 * back to the implementation provided by the @peculiar/webcrypto package.
 */
const kWebCryptoImpl =
    (globalThis.crypto && globalThis.crypto.subtle) ? globalThis.crypto : new Crypto();

/**
 * Interface describing the information contained within a password reset request. This will be
 * cryptographically sealed by our server to control genuinity.
 */
export type PasswordResetRequest = SessionData;

/**
 * Creates a sealed password reset request containing the information from the `request`. This is
 * safe to be shared with that particular user, and allows for a one-time password reset. The
 * request will be valid for a maximum of `kPasswordResetRequestExpirySeconds` seconds.
 *
 * @param request The password request in plaintext form.
 * @returns The sealed password reset request, as a string.
 */
export async function sealPasswordResetRequest(request: PasswordResetRequest): Promise<string> {
    return encodeURIComponent(await seal(kWebCryptoImpl, request, kPasswordResetRequestPassword, {
        ...ironDefaults,
        ttl: kPasswordResetRequestExpirySeconds * /* milliseconds= */ 1000,
    }));
}

/**
 * Unseals the given `sealedRequest`.
 *
 * @param request The sealed password reset request, as a string.
 * @returns The password request in plaintext form.
 */
export async function unsealPasswordResetRequest(request: string): Promise<PasswordResetRequest> {
    return await unseal(kWebCryptoImpl, decodeURIComponent(request),
        kPasswordResetRequestPassword, {
            ...ironDefaults,
            ttl: kPasswordResetRequestExpirySeconds * /* milliseconds= */ 1000,
        }) as PasswordResetRequest;
}
