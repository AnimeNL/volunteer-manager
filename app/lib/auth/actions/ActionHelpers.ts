// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';
import { cookies, headers } from 'next/headers';

import { RecordLog } from '@lib/Log';
import { createAndWriteUserSessionCookie } from '../SessionStore';
import { findActiveUser, setUserPassword } from '../AccountStore';
import { normalizeClientIp } from '../RateLimit';
import { unsealPasswordResetRequest } from '../Tokens';
import { validatePasswordStrength } from '../Password';

/**
 * Request metadata derived from the trusted server-injected HTTP headers for an auth action.
 */
interface AuthRequestMetadata {
    host: string;
    origin: string;
    rpId: string;
    ip: string;
    userAgent?: string;
}

/**
 * Extracts host, WebAuthn origin/RP ID, normalized client IP, and user agent from request headers.
 */
export async function getAuthRequestMetadata(): Promise<AuthRequestMetadata> {
    const requestHeaders = await headers();
    const host = requestHeaders.get('host') ?? 'animecon.team';
    const origin = host.startsWith('localhost') ? `http://${host}` : `https://${host}`;
    const rpId = host.replace(/:.*$/, '');
    const ip = normalizeClientIp(requestHeaders.get('x-forwarded-for') ?? undefined);
    const userAgent = requestHeaders.get('user-agent') ?? undefined;

    return { host, origin, rpId, ip, userAgent };
}

const kBirthdatePattern = /^(?:19|20)\d{2}-\d{2}-\d{2}$/;

/**
 * Parses a strict `YYYY-MM-DD` birthdate string (1900-2099) into a `Temporal.PlainDate`,
 * returning `undefined` when malformed or calendar-invalid instead of throwing `RangeError`.
 */
export function parseBirthdate(value?: string): Temporal.PlainDate | undefined {
    if (!value || !kBirthdatePattern.test(value))
        return undefined;

    try {
        return Temporal.PlainDate.from(value, { overflow: 'reject' });
    } catch {
        return undefined;
    }
}

/**
 * Standard result returned by authentication mutations.
 */
export interface AuthActionResult {
    success: boolean;
    error?: string;
}

/**
 * Parameters for completing a token-authenticated password update (access-code sign-in or password
 * reset).
 */
interface CompletePasswordUpdateParams {
    token: string;
    password: string;
    meta: Pick<AuthRequestMetadata, 'ip' | 'userAgent'>;
    expiredError: string;
    invalidError: string;
    logType: Parameters<typeof RecordLog>[0]['type'];
}

/**
 * Validates password strength, unseals and verifies the single-use reset token, updates the user's
 * password (revoking prior sessions), writes a fresh session cookie, and records an audit log.
 */
export async function completePasswordUpdateWithToken(
    params: CompletePasswordUpdateParams): Promise<AuthActionResult>
{
    const strengthError = validatePasswordStrength(params.password);
    if (strengthError)
        return { success: false, error: strengthError };

    let resetRequest: { id: number; token: number };
    try {
        resetRequest = unsealPasswordResetRequest(params.token);
    } catch {
        return { success: false, error: params.expiredError };
    }

    const user = await findActiveUser(resetRequest.id, resetRequest.token);
    if (!user)
        return { success: false, error: params.invalidError };

    const updated = await setUserPassword(user.id, params.password, {
        revokeSessions: true,
        expectedSessionToken: resetRequest.token,
    });

    if (!updated)
        return { success: false, error: params.invalidError };

    await createAndWriteUserSessionCookie(await cookies(), {
        userId: user.id,
        ip: params.meta.ip,
        userAgent: params.meta.userAgent,
    });

    RecordLog({
        type: params.logType,
        sourceUser: user.id,
        data: { ip: params.meta.ip },
    });

    return { success: true };
}
