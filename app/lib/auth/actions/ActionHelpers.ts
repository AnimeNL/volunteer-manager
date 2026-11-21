// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';
import { cookies, headers } from 'next/headers';

import { RecordLog } from '@lib/Log';
import { createAndWriteUserSessionCookie } from '../SessionStore';
import { loadUserAuthenticationContext } from '../AuthenticationContext';
import { normalizeClientIp } from '../RateLimit';
import { setUserPassword } from '../AccountStore';
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

/**
 * Validates that an optional redirect URL is a safe relative path (starts with a single `/`,
 * rejecting protocol-relative `//...` and absolute URLs). Returns `undefined` when invalid.
 */
export function sanitizeRelativeRedirectUrl(url?: string): string | undefined {
    if (typeof url === 'string' && /^\/(?!\/)/.test(url))
        return url;

    return undefined;
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
    params: CompletePasswordUpdateParams): Promise<{ success: boolean; error?: string }>
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

    const { user } = await loadUserAuthenticationContext({ type: 'session', ...resetRequest });
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
        sourceUser: user,
        data: { ip: params.meta.ip },
    });

    return { success: true };
}
