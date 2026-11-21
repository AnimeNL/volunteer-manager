// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { cookies } from 'next/headers';
import { z } from 'zod/v4';

import { LogBuilder } from '@lib/log/index';
import { Publish, kSubscriptionType } from '@lib/subscriptions';
import { RecordErrorLog, RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { SendEmailTask } from '@lib/scheduler/tasks/SendEmailTask';
import { checkRateLimit } from '../RateLimit';
import { createAccountWithPassword, isUsernameAvailable, setUserPassword, verifyUserCredentials }
    from '../AccountStore';
import { createAndWriteUserSessionCookie } from '../SessionStore';
import { determineEnvironment } from '@lib/Environment';
import { completePasswordUpdateWithToken, getAuthRequestMetadata, sanitizeRelativeRedirectUrl }
    from './ActionHelpers';
import { getSessionFromCookieStore } from '../Session';
import { getStaticContent } from '@lib/Content';
import { loadUserAuthenticationContext, requireAuthenticationContext }
    from '../AuthenticationContext';
import { sealPasswordResetRequest, sealRegistrationRequest, unsealPasswordResetRequest,
    unsealRegistrationRequest } from '../Tokens';
import { validatePasswordStrength } from '../Password';
import db, { tUsers } from '@lib/database';

import { kAuthRateLimits } from '../RateLimit';

const kEmailSenderName = 'AnimeCon Volunteering Teams';

const kRegisterInput = z.object({
    username: z.string().trim().pipe(z.email()),
    password: z.string(),
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    gender: z.string().trim().min(1),
    birthdate: z.string().regex(/^[1|2](\d{3})-(\d{2})-(\d{2})$/),
    phoneNumber: z.string().trim().min(1),
    discordHandle: z.string().trim().optional(),
    gdpr: z.boolean().optional(),
    redirectUrl: z.string().optional(),
});

const kRegisterActivateInput = z.object({
    registrationRequest: z.string().min(1),
});

const kPasswordResetRequestInput = z.object({
    username: z.string().trim().pipe(z.email()),
});

const kPasswordResetVerifyInput = z.object({
    request: z.string().min(1),
});

const kCompletePasswordResetInput = z.object({
    password: z.string(),
    request: z.string().min(1),
});

const kChangePasswordInput = z.object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string(),
});

/**
 * Input accepted by `registerAction()`.
 */
export type RegisterActionInput = z.input<typeof kRegisterInput>;

/**
 * Standard result returned by account authentication mutations.
 */
export interface AccountAuthResult {
    success: boolean;
    error?: string;
}

/**
 * Result returned by `registerActivateAction()`.
 */
export interface RegisterActivateResult {
    success: boolean;
    firstName?: string;
    teamName?: string;
    redirectUrl?: string;
}

/**
 * Result returned by `verifyPasswordResetAction()`.
 */
export interface VerifyPasswordResetResult {
    success: boolean;
    firstName?: string;
}

/**
 * Creates a new unactivated volunteer account with an Argon2id password hash and schedules a
 * registration confirmation e-mail containing a sealed activation token.
 */
export async function registerAction(input: RegisterActionInput): Promise<AccountAuthResult> {
    const parsed = kRegisterInput.safeParse(input);
    if (!parsed.success)
        return { success: false, error: 'Please complete all required registration fields.' };

    const meta = await getAuthRequestMetadata();
    const rateLimit = checkRateLimit('register-ip', meta.ip, kAuthRateLimits.registerByIp);
    if (!rateLimit.allowed)
        return { success: false, error: 'Too many registration attempts. Please try again later.' };

    const data = parsed.data;
    if (!data.gdpr)
        return { success: false, error: 'You must accept our GDPR & privacy policies.' };

    const strengthError = validatePasswordStrength(data.password);
    if (strengthError)
        return { success: false, error: strengthError };

    if (!await isUsernameAvailable(data.username))
        return { success: false, error: 'There already is an account with that username.' };

    const userId = await createAccountWithPassword({
        username: data.username,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        gender: data.gender,
        birthdate: data.birthdate,
        phoneNumber: data.phoneNumber,
        discordHandle: data.discordHandle,
    });

    if (!userId)
        return { success: false, error: 'The server was unable to create an account.' };

    const safeRedirectUrl = sanitizeRelativeRedirectUrl(data.redirectUrl);
    const registrationRequest = await sealRegistrationRequest({
        id: userId,
        redirectUrl: safeRedirectUrl,
    });

    const messageContent = await getStaticContent([ 'message', 'registration' ], {
        disableJsx: true,
        substitutions: {
            link: `https://${meta.host}/?registration-request=${registrationRequest}`,
            name: data.firstName,
            sender: kEmailSenderName,
        },
    });

    if (messageContent) {
        await SendEmailTask.Schedule({
            sender: kEmailSenderName,
            message: {
                to: data.username,
                subject: messageContent.title,
                markdown: messageContent.markdown,
            },
            attribution: {
                sourceUserId: userId,
                targetUserId: userId,
            },
        });
    }

    await Publish({
        type: kSubscriptionType.Registration,
        sourceUserId: userId,
        message: {
            userId,
            name: `${data.firstName} ${data.lastName}`,
            emailAddress: data.username,
            ip: meta.ip,
        },
    });

    LogBuilder.for('AccountRegister')
        .withInitiatorUser(userId)
        .record();

    return { success: true };
}

/**
 * Confirms an account registration using the sealed token sent via e-mail, activates the account,
 * and signs the user in with a new persistent session cookie.
 */
export async function registerActivateAction(
    input: { registrationRequest: string }): Promise<RegisterActivateResult>
{
    const parsed = kRegisterActivateInput.safeParse(input);
    if (!parsed.success)
        return { success: false };

    const meta = await getAuthRequestMetadata();
    const rateLimit = checkRateLimit('register-ip', meta.ip, kAuthRateLimits.registerByIp);
    if (!rateLimit.allowed)
        return { success: false };

    let registrationRequest: { id: number; redirectUrl?: string };
    try {
        registrationRequest = await unsealRegistrationRequest(parsed.data.registrationRequest);
    } catch {
        return { success: false };
    }

    const environment = await determineEnvironment();
    if (!environment)
        return { success: false };

    const affectedRows = await db.update(tUsers)
        .set({ activated: /* true= */ 1 })
        .where(tUsers.userId.equals(registrationRequest.id))
            .and(tUsers.activated.equals(/* false= */ 0))
            .and(tUsers.anonymized.isNull())
        .executeUpdate(/* min= */ 0, /* max= */ 1);

    if (!affectedRows) {
        RecordErrorLog({
            error: new Error('Unable to identify the unactivated user account'),
            requestUrl: { pathname: '/register-activate' },
            severity: kLogSeverity.Info,
            source: 'Server',
        });

        return { success: false };
    }

    const { user } = await loadUserAuthenticationContext({
        type: 'userId',
        userId: registrationRequest.id,
    });
    if (!user)
        return { success: false };

    await createAndWriteUserSessionCookie(await cookies(), {
        userId: user.id,
        ip: meta.ip,
        userAgent: meta.userAgent,
    });

    RecordLog({
        type: kLogType.AccountActivate,
        sourceUser: user,
        data: { ip: meta.ip },
    });

    const safeRedirectUrl = sanitizeRelativeRedirectUrl(registrationRequest.redirectUrl);
    return {
        success: true,
        firstName: user.firstName,
        teamName: environment.title,
        redirectUrl: safeRedirectUrl ?? '/registration',
    };
}

/**
 * Schedules a password reset e-mail containing a short-lived sealed reset token for the activated
 * account matching `input.username`.
 */
export async function requestPasswordResetAction(
    input: { username: string }): Promise<AccountAuthResult>
{
    const parsed = kPasswordResetRequestInput.safeParse(input);
    if (!parsed.success)
        return { success: false };

    const meta = await getAuthRequestMetadata();
    const { username } = parsed.data;

    const ipLimit = checkRateLimit(
        'password-reset-ip', meta.ip, kAuthRateLimits.passwordResetByIp);
    const accountLimit = checkRateLimit(
        'password-reset-account', username, kAuthRateLimits.passwordResetByAccount);

    if (!ipLimit.allowed || !accountLimit.allowed) {
        return {
            success: false,
            error: 'Too many password reset requests. Please try again later.',
        };
    }

    const passwordResetData = await db.selectFrom(tUsers)
        .where(tUsers.username.equals(username))
            .and(tUsers.activated.equals(/* true= */ 1))
            .and(tUsers.anonymized.isNull())
        .select({
            userId: tUsers.userId,
            sessionToken: tUsers.sessionToken,
            firstName: tUsers.firstName,
        })
        .executeSelectNoneOrOne();

    if (!passwordResetData)
        return { success: false };

    const token = await sealPasswordResetRequest({
        id: passwordResetData.userId,
        token: passwordResetData.sessionToken,
    });

    const messageContent = await getStaticContent([ 'message', 'lost-password' ], {
        disableJsx: true,
        substitutions: {
            link: `https://${meta.host}/?password-reset-request=${token}`,
            name: passwordResetData.firstName,
            sender: kEmailSenderName,
        },
    });

    if (!messageContent) {
        console.error('Unable to send a password reset e-mail: cannot find the content.');
        return { success: false };
    }

    await SendEmailTask.Schedule({
        sender: kEmailSenderName,
        message: {
            to: username,
            subject: messageContent.title,
            markdown: messageContent.markdown,
        },
        attribution: {
            sourceUserId: passwordResetData.userId,
            targetUserId: passwordResetData.userId,
        },
    });

    RecordLog({
        type: kLogType.AccountPasswordResetRequest,
        sourceUser: passwordResetData.userId,
        data: { ip: meta.ip },
    });

    return { success: true };
}

/**
 * Verifies a sealed password reset token and returns the account's first name when valid.
 */
export async function verifyPasswordResetAction(
    input: { request: string }): Promise<VerifyPasswordResetResult>
{
    const parsed = kPasswordResetVerifyInput.safeParse(input);
    if (!parsed.success)
        return { success: false };

    let resetRequest: { id: number; token: number };
    try {
        resetRequest = await unsealPasswordResetRequest(parsed.data.request);
    } catch {
        return { success: false };
    }

    const { user } = await loadUserAuthenticationContext({ type: 'session', ...resetRequest });
    if (!user)
        return { success: false };

    return {
        success: true,
        firstName: user.firstName,
    };
}

/**
 * Completes a password reset using a valid sealed reset token, revokes all prior sessions, and
 * signs the user in with a new persistent session cookie.
 */
export async function completePasswordResetAction(
    input: { request: string; password: string }): Promise<AccountAuthResult>
{
    const parsed = kCompletePasswordResetInput.safeParse(input);
    if (!parsed.success)
        return { success: false, error: 'The server was not able to save the new password.' };

    const meta = await getAuthRequestMetadata();
    const ipLimit = checkRateLimit(
        'password-reset-ip', meta.ip, kAuthRateLimits.passwordResetByIp);
    if (!ipLimit.allowed)
        return { success: false, error: 'Too many requests. Please wait and try again.' };

    return completePasswordUpdateWithToken({
        token: parsed.data.request,
        password: parsed.data.password,
        meta,
        expiredError: 'This password reset link has expired.',
        invalidError: 'This password reset link is no longer valid.',
        logType: kLogType.AccountPasswordReset,
    });
}

/**
 * Changes the signed-in user's password after verifying their current plaintext password, revoking
 * all other device sessions while keeping the current session signed in.
 */
export async function changePasswordAction(
    input: { currentPassword: string; newPassword: string }): Promise<AccountAuthResult>
{
    const { user } = await requireAuthenticationContext(
        undefined, undefined, { bypassCache: true });

    const parsed = kChangePasswordInput.safeParse(input);
    if (!parsed.success)
        return { success: false, error: 'Please enter both your current and new password.' };

    const strengthError = validatePasswordStrength(parsed.data.newPassword);
    if (strengthError)
        return { success: false, error: strengthError };

    if (!user.username)
        return { success: false, error: 'Unable to verify your current password…' };

    const verification = await verifyUserCredentials(user.username, parsed.data.currentPassword);
    if (!verification.authenticated || verification.userId !== user.id)
        return { success: false, error: 'That is not your current password…' };

    const meta = await getAuthRequestMetadata();
    const cookieStore = await cookies();
    const currentSession = await getSessionFromCookieStore(cookieStore);

    if (currentSession) {
        await setUserPassword(user.id, parsed.data.newPassword, {
            revokeSessions: true,
            exceptSessionId: currentSession.sessionId,
        });
    } else {
        await setUserPassword(user.id, parsed.data.newPassword, { revokeSessions: true });
        await createAndWriteUserSessionCookie(cookieStore, {
            userId: user.id,
            ip: meta.ip,
            userAgent: meta.userAgent,
        });
    }

    RecordLog({
        type: kLogType.AccountPasswordUpdate,
        sourceUser: user,
        data: { ip: meta.ip },
    });

    return { success: true };
}
