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

import type { AuthActionResult } from './ActionHelpers';
import { LogBuilder } from '@lib/log';
import { RecordErrorLog, kLogSeverity } from '@lib/ErrorLog';
import { consumePasskeyChallengeCookie, writePasskeyChallengeCookie } from '../PasskeyChallenge';
import { deleteUserPasskey, retrieveUserPasskeys, storeUserPasskey } from '../PasskeyStore';
import { determineEnvironment } from '@lib/Environment';
import { formatDate } from '@lib/Temporal';
import { getAuthRequestMetadata } from './ActionHelpers';
import { requireAuthenticationContext } from '../AuthenticationContext';

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
interface ListPasskeysResult {
    success: boolean;
    error?: string;
    passkeys?: PasskeyListEntry[];
}

/**
 * Result returned by `createPasskeyChallengeAction()`.
 */
interface CreatePasskeyChallengeResult {
    success: boolean;
    error?: string;
    options?: {
        optionsJSON: PublicKeyCredentialCreationOptionsJSON;
    };
}

/**
 * Lists all WebAuthn passkeys registered for the signed-in user under the current RP ID.
 */
export async function listPasskeysAction(): Promise<ListPasskeysResult> {
    const { user } = await requireAuthenticationContext();
    if (!user.username)
        forbidden();

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
    const { user } = await requireAuthenticationContext(undefined, { bypassCache: true });

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
            userVerification: 'required',
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
        : Promise<AuthActionResult>
{
    const { user } = await requireAuthenticationContext(undefined, { bypassCache: true });

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

    let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
    try {
        verification = await verifyRegistrationResponse({
            response: parsed.data.registration,
            expectedChallenge,
            expectedOrigin: meta.origin,
            expectedRPID: meta.rpId,
            requireUserVerification: true,
        });
    } catch (error: unknown) {
        RecordErrorLog({
            error: error instanceof Error ? error : new Error(String(error)),
            requestUrl: { pathname: '/register-passkey' },
            severity: kLogSeverity.Warning,
            user,
        });

        return { success: false, error: 'The passkey registration could not be verified' };
    }

    if (!verification.verified || !verification.registrationInfo) {
        RecordErrorLog({
            error: new Error('WebAuthn registration response was not verified'),
            requestUrl: { pathname: '/register-passkey' },
            severity: kLogSeverity.Warning,
            user,
        });

        return { success: false, error: 'The passkey registration could not be verified' };
    }

    await storeUserPasskey(user.id, meta.rpId, parsed.data.name, verification.registrationInfo);

    LogBuilder.for('AccountPasskeyCreate')
        .withInitiatorUser(user)
        .withSeverity('Debug')
        .record();

    return { success: true };
}

/**
 * Deletes one of the signed-in user's registered passkeys.
 */
export async function deletePasskeyAction(input: { id: number }): Promise<AuthActionResult> {
    const { user } = await requireAuthenticationContext(undefined, { bypassCache: true });

    if (!user.username)
        forbidden();

    const parsed = kDeletePasskeyInput.safeParse(input);
    if (!parsed.success)
        return { success: false, error: 'Invalid passkey identifier.' };

    const credentialDeleted = await deleteUserPasskey(user.id, parsed.data.id);

    LogBuilder.for('AccountPasskeyDelete')
        .withCondition(credentialDeleted)
        .withInitiatorUser(user)
        .withSeverity('Debug')
        .record();

    return { success: true };
}
