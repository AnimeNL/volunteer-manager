// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import type { AuthenticationResponseJSON, PublicKeyCredentialRequestOptionsJSON,
    VerifyAuthenticationResponseOpts } from '@simplewebauthn/server';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { z } from 'zod/v4';

import type { StoredPasskeyCredential } from '../PasskeyStore';
import { RecordErrorLog, RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { checkRateLimit, resetRateLimit } from '../RateLimit';
import { clearUserAccessCode, createPasswordResetToken, isValidActivatedUser,
    verifyUserCredentials } from '../AccountStore';
import { completePasswordUpdateWithToken, getAuthRequestMetadata } from './ActionHelpers';
import { consumePasskeyChallengeCookie, writePasskeyChallengeCookie } from '../PasskeyChallenge';
import { createAndWriteUserSessionCookie, revokeAndClearCurrentSessionCookie }
    from '../SessionStore';
import { retrieveUserPasskeys, updatePasskeyCounter } from '../PasskeyStore';

import { kAuthRateLimits } from '../RateLimit';

const kConfirmIdentityInput = z.object({
    username: z.string().trim().pipe(z.email()),
});

const kSignInPasswordInput = z.object({
    username: z.string().trim().pipe(z.email()),
    password: z.string().min(1).max(128),
});

const kSignInPasswordUpdateInput = z.object({
    password: z.string(),
    passwordResetRequest: z.string().min(1),
});

const kSignInPasskeyInput = z.object({
    username: z.string().trim().pipe(z.email()),
    verification: z.custom<AuthenticationResponseJSON>(
        value => !!value && typeof value === 'object' && typeof (value as any).id === 'string'),
});

/**
 * Result returned by `confirmIdentityAction()`.
 */
interface ConfirmIdentityResult {
    success: boolean;
    activated?: boolean;
    authenticationOptions?: {
        optionsJSON: PublicKeyCredentialRequestOptionsJSON;
        useBrowserAutofill: boolean;
    };
    error?: string;
}

/**
 * Result returned by `signInPasswordAction()`.
 */
interface SignInPasswordResult {
    success: boolean;
    requiredPasswordUpdateToken?: string;
    error?: string;
}

/**
 * Result returned by `signInPasswordUpdateAction()` and `signInPasskeyAction()`.
 */
interface SignInActionResult {
    success: boolean;
    error?: string;
}

/**
 * Result returned by `signOutAction()`.
 */
interface SignOutResult {
    success: true;
    returnUrl?: string;
}

/**
 * Compares two byte buffers in constant time.
 */
function timingSafeEqualBytes(left: Uint8Array, right: Uint8Array): boolean {
    if (left.byteLength !== right.byteLength)
        return false;

    return crypto.timingSafeEqual(left, right);
}

type MatchedPasskey = {
    passkeyId: number;
    credential: VerifyAuthenticationResponseOpts['credential'];
};

/**
 * Finds the stored passkey credential matching `credentialIdBase64Url` in constant time.
 */
function findMatchingPasskey(
    credentials: StoredPasskeyCredential[], credentialIdBase64Url: string)
        : MatchedPasskey | undefined
{
    const requestedId = Buffer.from(credentialIdBase64Url, 'base64url');
    for (const stored of credentials) {
        if (!timingSafeEqualBytes(requestedId, stored.credentialId))
            continue;

        return {
            passkeyId: stored.passkeyId,
            credential: {
                id: isoBase64URL.fromBuffer(stored.credentialId),
                publicKey: stored.credentialPublicKey,
                counter: Number(stored.counter),
            },
        };
    }

    return undefined;
}

/**
 * Confirms whether an account exists for `input.username`. When the account is active and has
 * passkeys registered for the current RP ID, issues a WebAuthn challenge in a sealed `HttpOnly`
 * cookie and returns the corresponding authentication options.
 *
 * Intentionally discloses account existence, activation state, and passkey availability to power
 * the identifier-first `<AuthenticationFlow>` UI; protected against bulk enumeration by
 * `confirm-identity-ip` rate limiting.
 */
export async function confirmIdentityAction(
    input: { username: string }): Promise<ConfirmIdentityResult>
{
    const parsed = kConfirmIdentityInput.safeParse(input);
    if (!parsed.success)
        return { success: false, error: 'Please enter a valid e-mail address.' };

    const meta = await getAuthRequestMetadata();
    const rateLimit = checkRateLimit(
        'confirm-identity-ip', meta.ip, kAuthRateLimits.confirmIdentityByIp);
    if (!rateLimit.allowed)
        return { success: false, error: 'Too many requests. Please wait a moment and try again.' };

    const { username } = parsed.data;
    const user = await isValidActivatedUser(username);

    RecordLog({
        type: kLogType.AccountIdentityCheck,
        severity: kLogSeverity.Debug,
        data: {
            userId: user?.id,
            username,
            origin: meta.host,
            ip: meta.ip,
        },
    });

    if (!user)
        return { success: false };

    let authenticationOptions: ConfirmIdentityResult['authenticationOptions'];
    if (user.activated) {
        const credentials = await retrieveUserPasskeys(user.id, meta.rpId);
        if (credentials.length > 0) {
            const options = await generateAuthenticationOptions({
                rpID: meta.rpId,
                userVerification: 'required',
                allowCredentials: credentials.map(credential => ({
                    id: isoBase64URL.fromBuffer(credential.credentialId),
                })),
            });

            writePasskeyChallengeCookie(await cookies(), {
                challenge: options.challenge,
                flow: 'authenticate',
                rpId: meta.rpId,
                userId: user.id,
            });

            authenticationOptions = {
                optionsJSON: options,
                useBrowserAutofill: false,
            };
        }
    }

    return {
        success: true,
        activated: user.activated,
        authenticationOptions,
    };
}

/**
 * Signs the user in with their plaintext password (silently upgrading legacy hashes to Argon2id)
 * or one-time access code (returning a sealed password update token).
 */
export async function signInPasswordAction(
    input: { username: string; password: string }): Promise<SignInPasswordResult>
{
    const parsed = kSignInPasswordInput.safeParse(input);
    if (!parsed.success)
        return { success: false };

    const { username, password } = parsed.data;
    const meta = await getAuthRequestMetadata();

    if (!checkRateLimit('signin-ip', meta.ip, kAuthRateLimits.signInByIp).allowed ||
        !checkRateLimit('signin-account', username, kAuthRateLimits.signInByAccount).allowed)
    {
        return {
            success: false,
            error: 'Too many sign-in attempts. Please wait a few minutes and try again.',
        };
    }

    const verification = await verifyUserCredentials(username, password);
    if (!verification.authenticated)
        return { success: false };

    resetRateLimit('signin-account', username);

    if (verification.authType === 'code') {
        const requiredPasswordUpdateToken = await createPasswordResetToken(verification.userId);
        if (!requiredPasswordUpdateToken)
            return { success: false };

        RecordLog({
            type: kLogType.AccountIdentifyAccessCode,
            severity: kLogSeverity.Debug,
            sourceUser: verification.userId,
            data: { ip: meta.ip },
        });

        return {
            success: true,
            requiredPasswordUpdateToken,
        };
    }

    await createAndWriteUserSessionCookie(await cookies(), {
        userId: verification.userId,
        ip: meta.ip,
        userAgent: meta.userAgent,
    });

    RecordLog({
        type: kLogType.AccountIdentifyPassword,
        severity: kLogSeverity.Debug,
        sourceUser: verification.userId,
        data: { ip: meta.ip },
    });

    return { success: true };
}

/**
 * Completes sign-in after an access code login by validating and storing the user's new password,
 * revoking older sessions, and issuing a fresh persistent session cookie.
 */
export async function signInPasswordUpdateAction(
    input: { password: string; passwordResetRequest: string }): Promise<SignInActionResult>
{
    const parsed = kSignInPasswordUpdateInput.safeParse(input);
    if (!parsed.success)
        return { success: false, error: 'Your password could not be updated. Try again?' };

    const meta = await getAuthRequestMetadata();
    const ipLimit = checkRateLimit('signin-ip', meta.ip, kAuthRateLimits.signInByIp);
    if (!ipLimit.allowed)
        return { success: false, error: 'Too many attempts. Please wait and try again.' };

    return completePasswordUpdateWithToken({
        token: parsed.data.passwordResetRequest,
        password: parsed.data.password,
        meta,
        expiredError: 'Your password update session has expired. Try again?',
        invalidError: 'Your password update session is no longer valid.',
        logType: kLogType.AccountPasswordUpdate,
    });
}

/**
 * Signs the user in using a WebAuthn passkey assertion verified against the single-use sealed
 * challenge cookie issued by `confirmIdentityAction()`.
 */
export async function signInPasskeyAction(
    input: { username: string; verification: AuthenticationResponseJSON })
        : Promise<SignInActionResult>
{
    const parsed = kSignInPasskeyInput.safeParse(input);
    if (!parsed.success)
        return { success: false, error: 'Invalid passkey authentication request.' };

    const meta = await getAuthRequestMetadata();
    const ipLimit = checkRateLimit('signin-ip', meta.ip, kAuthRateLimits.signInByIp);
    if (!ipLimit.allowed)
        return { success: false, error: 'Too many attempts. Please wait and try again.' };

    const user = await isValidActivatedUser(parsed.data.username);
    if (!user || !user.activated)
        return { success: false };

    const cookieStore = await cookies();
    const challenge = consumePasskeyChallengeCookie(cookieStore, {
        flow: 'authenticate',
        rpId: meta.rpId,
        userId: user.id,
    });

    if (!challenge)
        return { success: false, error: 'The passkey challenge has expired. Please try again.' };

    const credentials = await retrieveUserPasskeys(user.id, meta.rpId);
    const match = findMatchingPasskey(credentials, parsed.data.verification.id);
    if (!match)
        return { success: false, error: 'Unable to find the used credential Id.' };

    let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>;
    try {
        verification = await verifyAuthenticationResponse({
            response: parsed.data.verification,
            expectedChallenge: challenge,
            expectedOrigin: meta.origin,
            expectedRPID: meta.rpId,
            credential: match.credential,
        });
    } catch (error: unknown) {
        RecordErrorLog({
            error: error instanceof Error ? error : new Error(String(error)),
            requestUrl: { pathname: '/signin-passkey' },
            severity: kLogSeverity.Warning,
            user: user.id,
        });

        return { success: false, error: 'Unable to verify the authentication response.' };
    }

    if (!verification.verified)
        return { success: false, error: 'Unable to verify the authentication response.' };

    await updatePasskeyCounter(
        user.id, match.passkeyId, BigInt(verification.authenticationInfo.newCounter));
    await clearUserAccessCode(user.id);

    await createAndWriteUserSessionCookie(cookieStore, {
        userId: user.id,
        ip: meta.ip,
        userAgent: meta.userAgent,
    });

    RecordLog({
        type: kLogType.AccountIdentifyPasskey,
        severity: kLogSeverity.Debug,
        sourceUser: user.id,
        data: { ip: meta.ip },
    });

    return { success: true };
}

/**
 * Signs out the current device session, restoring the impersonator's session when applicable.
 */
export async function signOutAction(): Promise<SignOutResult> {
    const meta = await getAuthRequestMetadata();
    const result = await revokeAndClearCurrentSessionCookie(await cookies(), {
        ip: meta.ip,
        userAgent: meta.userAgent,
    });

    return {
        success: true,
        returnUrl: result.returnUrl,
    };
}
