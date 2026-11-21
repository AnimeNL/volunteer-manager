// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { useMockConnection } from '@lib/database/Connection';
import { Cache } from '@lib/cache';
import { clearRateLimits } from '../RateLimit';
import { expectAuthenticationQuery } from '../AuthenticationTestHelpers';
import { hashSessionSecret } from '../SessionStore';
import { initialisePermissionRoles } from '../access/PermissionRoles';
import { kSessionCookieName, sealSession } from '../Session';

type MockConnection = ReturnType<typeof useMockConnection>;

/**
 * Shared in-memory cookie jar for Server Action tests.
 */
export const mockCookieJar = new Map<string, { value: string; options: any }>();

/**
 * Minimal Next.js `cookies()` store backed by `mockCookieJar`.
 */
export const mockCookieStore = {
    get: (name: string) => {
        const entry = mockCookieJar.get(name);
        return entry ? { name, value: entry.value } : undefined;
    },
    set: (name: string, value: string, options: any) => {
        mockCookieJar.set(name, { value, options });
    },
};

let currentHeaders = new Headers();

/**
 * Returns the current mocked request headers.
 */
export function getMockHeaders(): Headers {
    return currentHeaders;
}

/**
 * Resets cookie jar, auth cache, rate limits, permission roles, and default request headers.
 */
export async function resetAuthActionTestState(ip = '203.0.113.10'): Promise<void> {
    mockCookieJar.clear();
    Cache.getInstance('Authentication').clear();
    clearRateLimits();
    await initialisePermissionRoles([]);
    currentHeaders = new Headers({
        host: 'animecon.team',
        'x-forwarded-for': ip,
        'user-agent': 'Vitest/1.0',
    });
}

/**
 * Seeds a sealed persistent session cookie in `mockCookieJar` and registers the corresponding
 * database expectations for session verification, context loading, and `last_seen` update.
 */
export async function signInTestUser(
    mockConnection: MockConnection,
    options: {
        userId: number;
        sessionId?: number;
        secret?: string;
        username?: string;
        grants?: string;
    }): Promise<void>
{
    const sessionId = options.sessionId ?? 55;
    const secret = options.secret ?? 'action-test-secret';
    const cookie = await sealSession({ sessionId, userId: options.userId, secret });
    mockCookieJar.set(kSessionCookieName, { value: cookie, options: {} });

    mockConnection.expect('selectOneRow', () => ({
        sessionId,
        userId: options.userId,
        sessionTokenHash: hashSessionSecret(secret),
        impersonatorUserId: null,
        impersonatorReturnUrl: null,
    }));
    expectAuthenticationQuery(mockConnection, {
        userId: options.userId,
        username: options.username ?? 'alice@example.com',
        accessControl: options.grants ? { grants: options.grants } : undefined,
    });
    mockConnection.expect('update', () => 1);
}

/**
 * Registers the database expectations for `setUserPassword(..., { revokeSessions: true })`.
 */
export function expectSetUserPassword(
    mockConnection: MockConnection,
    options?: {
        onInsertHash?: (hash: string) => void;
        onRevokeParams?: (params: any[]) => void;
        revokedCount?: number;
    }): void
{
    mockConnection.expect('beginTransaction');
    mockConnection.expect('delete', () => 1);
    mockConnection.expect('insert', (_query: string, params: any[]) => {
        options?.onInsertHash?.(params[2]);
        return 1;
    });
    mockConnection.expect('update', () => 1);
    mockConnection.expect('commit');
    mockConnection.expect('delete', (_query: string, params: any[]) => {
        options?.onRevokeParams?.(params);
        return options?.revokedCount ?? 0;
    });
}
