// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { seal, unseal } from './Iron';

/**
 * The password through which registration requests will be sealed. This must be set in the global
 * environment at build time, and is considered sensitive information.
 */
const kRegistrationRequestPassword = process.env.APP_REGISTRATION_PASSWORD!;
if (!kRegistrationRequestPassword || !kRegistrationRequestPassword.length)
    throw new Error('Unable to start the Volunteer Manager without a APP_REGISTRATION_PASSWORD');

/**
 * Number of seconds that a registration reset request is valid for.
 */
const kRegistrationRequestExpirySeconds = 31 * 86400;  // one month

/**
 * Interface describing the information contained within a registration. This will be
 * cryptographically sealed by our server to control genuinity.
 */
export interface RegistrationRequest {
    /**
     * Unique ID of the user for whom the registration request was created.
     */
    id: number;

    /**
     * Optional URL to which the user should be redirected following verification.
     */
    redirectUrl?: string;
}

/**
 * Creates a sealed registration request containing the information from the `request`. This is safe
 * to be shared with that particular user, and allows for a one-time verification of their account.
 * The request will be valid for a maximum of `kRegistrationRequestExpirySeconds` seconds.
 *
 * @param request The registration request in plaintext form.
 * @returns The sealed registration request, as a string.
 */
export async function sealRegistrationRequest(request: RegistrationRequest): Promise<string> {
    return encodeURIComponent(
        await seal(request, kRegistrationRequestPassword, kRegistrationRequestExpirySeconds));
}

/**
 * Unseals the given `request`. Invalid or expired tokens will throw an exception.
 *
 * @param request The sealed registration request, as a string.
 * @returns The registration request in plaintext form.
 */
export async function unsealRegistrationRequest(request: string): Promise<RegistrationRequest> {
    return await unseal(decodeURIComponent(request), kRegistrationRequestPassword) as
        RegistrationRequest;
}
