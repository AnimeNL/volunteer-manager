// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import type { PublicKeyCredentialCreationOptionsJSON, RegistrationResponseJSON }
    from '@simplewebauthn/server';
import { cookies } from 'next/headers';
import { forbidden, notFound } from 'next/navigation';
import { generateRegistrationOptions, verifyRegistrationResponse } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { z } from 'zod/v4';

import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { consumePasskeyChallengeCookie, writePasskeyChallengeCookie } from './PasskeyChallenge';
import { deleteUserPasskey, getAuthRequestMetadata, retrieveUserPasskeys, storeUserPasskey }
    from './AuthHelpers';
import { determineEnvironment } from '@lib/Environment';
import { formatDate } from '@lib/Temporal';
import { requireAuthenticationContext } from './AuthenticationContext';

const kRegisterPasskeyInput = z.object({
    name: z.string().trim().max(128).optional(),
    registration: z.custom<RegistrationResponseJSON>(
        value => !!value && typeof value === 'object' && typeof (value as any).id === 'string'),
});

const kDeletePasskeyInput = z.object({
    id: z.number().int().positive(),
});

/**
 * Passkey entry returned to the client UI.
 */
export interface PasskeyListEntry {
    id: number;
    label: string;
    description: string;
}

/**
 * Result returned by `listPasskeysAction()`.
 */
export interface ListPasskeysResult {
    success: boolean;
    error?: string;
    passkeys?: PasskeyListEntry[];
}

/**
 * Result returned by `createPasskeyChallengeAction()`.
 */
export interface CreatePasskeyChallengeResult {
    success: boolean;
    error?: string;
    options?: {
        optionsJSON: PublicKeyCredentialCreationOptionsJSON;
    };
}

/**
 * Result returned by `registerPasskeyAction()` and `deletePasskeyAction()`.
 */
export interface PasskeyMutationResult {
    success: boolean;
    error?: string;
}

/**
 * Lists all WebAuthn passkeys registered for the signed-in user under the current RP ID.
 */
export async function listPasskeysAction(): Promise<ListPasskeysResult> {
    const { user } = await requireAuthenticationContext();
    if (!user.username)
        forbidden();

    const environment = await determineEnvironment();
    if (!environment)
        notFound();

    const meta = await getAuthRequestMetadata();
    const credentials = await retrieveUserPasskeys(user.id, meta.rpId);

    const passkeys = credentials.map(credential => {
        const label = credential.name ?? `Passkey #${credential.passkeyId}`;

        let description = `Created on ${formatDate(credential.created, 'DD/MM/YYYY')}`;
        if (credential.lastUsed)
            description += `, last used on ${formatDate(credential.lastUsed, 'DD/MM/YYYY')}`;
        else
            description += ', never used';

        return { id: credential.passkeyId, label, description };
    });

    return { success: true, passkeys };
}

/**
 * Generates WebAuthn registration options for the signed-in user and stores the single-use
 * challenge in a sealed `HttpOnly` cookie.
 */
export async function createPasskeyChallengeAction(): Promise<CreatePasskeyChallengeResult> {
    const { user } = await requireAuthenticationContext(
        undefined, undefined, { bypassCache: true });

    if (!user.username)
        forbidden();

    const environment = await determineEnvironment();
    if (!environment)
        notFound();

    const meta = await getAuthRequestMetadata();
    const existingCredentials = await retrieveUserPasskeys(user.id, meta.rpId);

    const options = await generateRegistrationOptions({
        rpName: `AnimeCon ${environment.title}`,
        rpID: meta.rpId,
        userName: user.username,
        userDisplayName: user.name,
        attestationType: 'none',
        excludeCredentials: existingCredentials.map(credential => ({
            id: isoBase64URL.fromBuffer(credential.credentialId),
        })),
        authenticatorSelection: {
            residentKey: 'preferred',
            userVerification: 'preferred',
        },
    });

    if (!options || !options.challenge)
        return { success: false, error: 'Unable to generate a registration response' };

    writePasskeyChallengeCookie(await cookies(), {
        challenge: options.challenge,
        flow: 'register',
        rpId: meta.rpId,
        userId: user.id,
    });

    return {
        success: true,
        options: { optionsJSON: options },
    };
}

/**
 * Verifies a WebAuthn passkey registration response against the sealed challenge cookie and saves
 * the credential to `users_passkeys`.
 */
export async function registerPasskeyAction(
    input: { name?: string; registration: RegistrationResponseJSON })
        : Promise<PasskeyMutationResult>
{
    const { user } = await requireAuthenticationContext(
        undefined, undefined, { bypassCache: true });

    if (!user.username)
        forbidden();

    const parsed = kRegisterPasskeyInput.safeParse(input);
    if (!parsed.success)
        return { success: false, error: 'Invalid passkey registration request.' };

    const meta = await getAuthRequestMetadata();
    const expectedChallenge = consumePasskeyChallengeCookie(await cookies(), {
        flow: 'register',
        rpId: meta.rpId,
        userId: user.id,
    });

    if (!expectedChallenge)
        return { success: false, error: 'You are not currently in a passkey registration flow' };

    const verification = await verifyRegistrationResponse({
        response: parsed.data.registration,
        expectedChallenge,
        expectedOrigin: meta.origin,
        expectedRPID: meta.rpId,
    });

    if (!verification.verified || !verification.registrationInfo)
        return { success: false, error: 'The passkey registration could not be verified' };

    await storeUserPasskey(user.id, meta.rpId, parsed.data.name, verification.registrationInfo);

    RecordLog({
        type: kLogType.AccountPasskeyCreate,
        severity: kLogSeverity.Debug,
        sourceUser: user,
        data: { ip: meta.ip },
    });

    return { success: true };
}

/**
 * Deletes one of the signed-in user's registered passkeys.
 */
export async function deletePasskeyAction(input: { id: number }): Promise<PasskeyMutationResult> {
    const { user } = await requireAuthenticationContext(
        undefined, undefined, { bypassCache: true });

    if (!user.username)
        forbidden();

    const parsed = kDeletePasskeyInput.safeParse(input);
    if (!parsed.success)
        return { success: false, error: 'Invalid passkey identifier.' };

    const meta = await getAuthRequestMetadata();
    const credentialDeleted = await deleteUserPasskey(user.id, parsed.data.id);

    if (credentialDeleted) {
        RecordLog({
            type: kLogType.AccountPasskeyDelete,
            severity: kLogSeverity.Debug,
            sourceUser: user,
            data: { ip: meta.ip },
        });
    }

    return { success: true };
}
