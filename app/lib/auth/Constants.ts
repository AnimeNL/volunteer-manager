// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Whether authentication cookies should carry the `Secure` attribute. Enabled in production where
 * traffic is served over HTTPS, while still allowing local HTTP development.
 */
const kSecureCookie = process.env.NODE_ENV === 'production';

/**
 * Number of seconds after which an authentication session expires (270 days, covering an annual
 * festival preparation cycle while ensuring volunteers sign in again between editions).
 */
export const kSessionExpirationTimeSeconds = 270 * 24 * 60 * 60;

/**
 * Builds standard `HttpOnly`, `SameSite=Lax` cookie attributes for authentication cookies.
 */
export function buildCookieOptions(maxAge: number) {
    return {
        httpOnly: true,
        maxAge,
        path: '/',
        sameSite: 'lax' as const,
        secure: kSecureCookie,
    };
}
