// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';
import { headers } from 'next/headers';

import { normalizeClientIp } from '../RateLimit';

/**
 * Request metadata derived from the trusted server-injected HTTP headers for an auth action.
 */
export interface AuthRequestMetadata {
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
