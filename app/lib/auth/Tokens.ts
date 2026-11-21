// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';

import { requireSealingSecret, sealToken, unsealToken } from './SealedToken';

/**
 * Secrets used to seal password-reset and registration confirmation tokens. Both are validated at
 * module start-up.
 */
const kPasswordResetRequestPassword = requireSealingSecret('APP_PASSRESET_PASSWORD');
const kRegistrationRequestPassword = requireSealingSecret('APP_REGISTRATION_PASSWORD');

/**
 * Token lifetimes, in seconds.
 */
const kPasswordResetRequestExpirySeconds = 3 * 3600;     // three hours
const kRegistrationRequestExpirySeconds = 31 * 86400;    // one month

/**
 * Payload sealed into a single-use password reset token.
 */
interface PasswordResetRequest {
    /**
     * Unique ID of the user whose password is being reset.
     */
    id: number;

    /**
     * Current `users.session_token` for the account, rotated once the reset completes so tokens are
     * strictly single-use.
     */
    token: number;
}

/**
 * Payload sealed into an e-mail registration activation token.
 */
interface RegistrationRequest {
    /**
     * Unique ID of the user for whom the registration request was created.
     */
    id: number;

    /**
     * Expected `users.session_token` for the account, rotated upon activation and deactivation so
     * tokens cannot reactivate admin-deactivated accounts. Optional on unseal so in-flight tokens
     * issued before this field was introduced remain valid until expiry.
     */
    token?: number;

    /**
     * Optional relative URL to redirect the user to after activation.
     */
    redirectUrl?: string;
}

/**
 * Seals a single-use password reset token valid for `kPasswordResetRequestExpirySeconds`.
 */
export function sealPasswordResetRequest(request: PasswordResetRequest): string {
    return sealToken(
        request, 'password-reset', kPasswordResetRequestPassword,
        kPasswordResetRequestExpirySeconds);
}

/**
 * Unseals a password reset token. Throws if malformed, tampered, or expired.
 */
export function unsealPasswordResetRequest(request: string): PasswordResetRequest {
    return unsealToken<PasswordResetRequest>(
        request, 'password-reset', kPasswordResetRequestPassword);
}

/**
 * Seals an account registration confirmation token valid for `kRegistrationRequestExpirySeconds`.
 */
export function sealRegistrationRequest(
    request: RegistrationRequest & { token: number }): string
{
    return sealToken(
        request, 'registration', kRegistrationRequestPassword, kRegistrationRequestExpirySeconds);
}

/**
 * Unseals a registration confirmation token. Throws if malformed, tampered, or expired.
 */
export function unsealRegistrationRequest(request: string): RegistrationRequest {
    return unsealToken<RegistrationRequest>(
        request, 'registration', kRegistrationRequestPassword);
}
