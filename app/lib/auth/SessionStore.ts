// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';
import crypto from 'node:crypto';
import type { cookies } from 'next/headers';

import { Cache } from '@lib/cache';
import { getSessionFromCookieStore, writeEmptySessionCookieToStore,
    writeSealedSessionCookieToStore } from './Session';
import db, { tUsers, tUsersSessions } from '../database';

import { kSessionExpirationTimeSeconds } from './Constants';

type CookieStore = Awaited<ReturnType<typeof cookies>>;

/**
 * Number of random bytes generated for each per-device session secret (256 bits of entropy).
 */
const kSessionSecretBytes = 32;

/**
 * Maximum column lengths for optional session audit metadata.
 */
const kMaxIpLength = 64;
const kMaxUserAgentLength = 255;

/**
 * Parameters accepted when creating a new persistent server-side user session.
 */
interface CreateSessionParams {
    userId: number;
    impersonatorUserId?: number;
    impersonatorReturnUrl?: string;
    ip?: string;
    userAgent?: string;
}

/**
 * Newly created session credentials returned to be sealed into the browser cookie.
 */
interface CreatedSession {
    sessionId: number;
    secret: string;
    userId: number;
}

/**
 * Verified server-side session record resolved from `users_sessions`.
 */
interface VerifiedSession {
    sessionId: number;
    userId: number;
    impersonatorUserId?: number;
    impersonatorReturnUrl?: string;
}

/**
 * Computes the hex-encoded SHA-256 hash of a session secret for storage at rest.
 */
export function hashSessionSecret(secret: string): string {
    return crypto.createHash('sha256').update(secret, 'utf8').digest('hex');
}

/**
 * Compares two hex-encoded digests in constant time.
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
    const bufferA = Buffer.from(a, 'hex');
    const bufferB = Buffer.from(b, 'hex');
    return bufferA.length === bufferB.length && crypto.timingSafeEqual(bufferA, bufferB);
}

/**
 * Validates that an optional redirect URL is a safe relative path (starts with a single `/`,
 * rejecting protocol-relative `//...`, backslashes, control characters, and absolute URLs).
 * Returns `undefined` when invalid.
 */
export function sanitizeRelativeRedirectUrl(url?: string): string | undefined {
    if (typeof url !== 'string' || !/^\/(?![/\\])/.test(url) ||
        /[\u0000-\u001f\u007f\\]/.test(url))
    {
        return undefined;
    }

    try {
        if (new URL(url, 'https://animecon.invalid').origin !== 'https://animecon.invalid')
            return undefined;
    } catch {
        return undefined;
    }

    return url;
}

/**
 * Creates a new per-device session row in `users_sessions` and returns its identifier and secret.
 */
export async function createUserSession(params: CreateSessionParams): Promise<CreatedSession> {
    const secret = crypto.randomBytes(kSessionSecretBytes).toString('base64url');
    const sessionTokenHash = hashSessionSecret(secret);
    const now = Temporal.Now.zonedDateTimeISO('UTC');
    const sessionExpires = now.add({ seconds: kSessionExpirationTimeSeconds });

    const sessionId = await db.insertInto(tUsersSessions)
        .set({
            userId: params.userId,
            sessionTokenHash,
            impersonatorUserId: params.impersonatorUserId ?? null,
            impersonatorReturnUrl:
                sanitizeRelativeRedirectUrl(params.impersonatorReturnUrl)?.slice(0, 255) ?? null,
            sessionExpires,
            sessionLastSeen: now,
            sessionIp: params.ip?.slice(0, kMaxIpLength) ?? null,
            sessionUserAgent: params.userAgent?.slice(0, kMaxUserAgentLength) ?? null,
        })
        .returningLastInsertedId()
        .executeInsert();

    return {
        sessionId,
        secret,
        userId: params.userId,
    };
}

/**
 * Verifies a `(sessionId, secret)` pair against `users_sessions` using constant-time hash
 * comparison and expiration checking. Returns `undefined` when invalid or expired.
 */
export async function verifyUserSession(
    sessionId: number, secret: string): Promise<VerifiedSession | undefined>
{
    const dbInstance = db;
    const row = await dbInstance.selectFrom(tUsersSessions)
        .where(tUsersSessions.sessionId.equals(sessionId))
            .and(tUsersSessions.sessionExpires.greaterThan(dbInstance.currentZonedDateTime()))
        .select({
            sessionId: tUsersSessions.sessionId,
            userId: tUsersSessions.userId,
            sessionTokenHash: tUsersSessions.sessionTokenHash,
            impersonatorUserId: tUsersSessions.impersonatorUserId,
            impersonatorReturnUrl: tUsersSessions.impersonatorReturnUrl,
        })
        .executeSelectNoneOrOne();

    if (!row || !timingSafeEqualHex(row.sessionTokenHash, hashSessionSecret(secret)))
        return undefined;

    return {
        sessionId: row.sessionId,
        userId: row.userId,
        impersonatorUserId: row.impersonatorUserId ?? undefined,
        impersonatorReturnUrl: row.impersonatorReturnUrl ?? undefined,
    };
}

/**
 * Updates `session_last_seen` for an active session (typically invoked on auth cache misses).
 */
export async function touchUserSession(sessionId: number): Promise<void> {
    const dbInstance = db;
    await dbInstance.update(tUsersSessions)
        .set({ sessionLastSeen: dbInstance.currentZonedDateTime() })
        .where(tUsersSessions.sessionId.equals(sessionId))
        .executeUpdate();
}

/**
 * Revokes a single device session by its `sessionId` (scoped to `userId` when provided),
 * invalidates the user's auth cache, and returns whether a matching session row was removed.
 */
export async function revokeUserSession(sessionId: number, userId?: number): Promise<boolean> {
    const deleted = await db.deleteFrom(tUsersSessions)
        .where(tUsersSessions.sessionId.equals(sessionId))
            .and(tUsersSessions.userId.equalsIfValue(userId))
        .executeDelete();

    if (userId !== undefined)
        Cache.getInstance('Authentication').delete(userId);

    return deleted > 0;
}

/**
 * Deletes all sessions belonging to `userId` — including any impersonation sessions initiated by
 * `userId` — (optionally preserving `exceptSessionId`) using `dbInstance`, returning the user IDs
 * whose auth cache entries should be invalidated after commit.
 */
export async function deleteAllUserSessions(
    dbInstance: typeof db, userId: number, exceptSessionId?: number): Promise<number[]>
{
    const impersonatedUserIds = await dbInstance.selectDistinctFrom(tUsersSessions)
        .where(tUsersSessions.impersonatorUserId.equals(userId))
            .and(tUsersSessions.sessionId.notEqualsIfValue(exceptSessionId))
        .selectOneColumn(tUsersSessions.userId)
        .executeSelectMany();

    await dbInstance.deleteFrom(tUsersSessions)
        .where(tUsersSessions.userId.equals(userId)
            .or(tUsersSessions.impersonatorUserId.equals(userId)))
        .and(tUsersSessions.sessionId.notEqualsIfValue(exceptSessionId))
        .executeDelete();

    return [ userId, ...impersonatedUserIds ];
}

/**
 * Invalidates cached authentication contexts for all `userIds`.
 */
export function evictAuthCacheForUsers(userIds: Iterable<number>): void {
    const authCache = Cache.getInstance('Authentication');
    for (const affectedUserId of userIds)
        authCache.delete(affectedUserId);
}

/**
 * Revokes all sessions belonging to `userId` — including any impersonation sessions initiated by
 * `userId` — (optionally preserving `exceptSessionId` when a user changes their own password) and
 * invalidates the affected auth cache entries.
 */
export async function revokeAllUserSessions(
    userId: number, exceptSessionId?: number): Promise<void>
{
    const affectedUserIds = await deleteAllUserSessions(db, userId, exceptSessionId);
    evictAuthCacheForUsers(affectedUserIds);
}

/**
 * Result returned when revoking and clearing the current session cookie.
 */
interface RevokeSessionResult {
    restoredImpersonator: boolean;
    returnUrl?: string;
}

/**
 * Checks whether the account identified by `userId` is currently activated and not anonymized.
 */
async function isActiveUser(userId: number): Promise<boolean> {
    const existing = await db.selectFrom(tUsers)
        .where(tUsers.userId.equals(userId))
            .and(tUsers.activated.equals(/* true= */ 1))
            .and(tUsers.anonymized.isNull())
        .selectOneColumn(tUsers.userId)
        .executeSelectNoneOrOne();

    return existing === userId;
}

/**
 * Creates a persistent session in `users_sessions` and writes it as a sealed cookie to
 * `cookieStore`. By default, revokes any existing session present in `cookieStore` first unless
 * `options.revokeExisting` is `false`.
 */
export async function createAndWriteUserSessionCookie(
    cookieStore: CookieStore,
    params: CreateSessionParams,
    options?: { revokeExisting?: boolean }): Promise<CreatedSession>
{
    if (options?.revokeExisting !== false) {
        const existing = await getSessionFromCookieStore(cookieStore);
        if (existing)
            await revokeUserSession(existing.sessionId, existing.userId);
    }

    const session = await createUserSession(params);
    await writeSealedSessionCookieToStore(session, cookieStore);
    return session;
}

/**
 * Revokes the current session in `cookieStore` (if any) and clears the cookie, or restores the
 * impersonator's session when signing out from an impersonation session.
 */
export async function revokeAndClearCurrentSessionCookie(
    cookieStore: CookieStore,
    metadata?: Pick<CreateSessionParams, 'ip' | 'userAgent'>): Promise<RevokeSessionResult>
{
    const session = await getSessionFromCookieStore(cookieStore);
    if (session) {
        const verified = await verifyUserSession(session.sessionId, session.secret);
        const revoked = verified && verified.userId === session.userId
            ? await revokeUserSession(verified.sessionId, verified.userId)
            : false;

        if (revoked && verified?.impersonatorUserId &&
            await isActiveUser(verified.impersonatorUserId))
        {
            await createAndWriteUserSessionCookie(cookieStore, {
                userId: verified.impersonatorUserId,
                ip: metadata?.ip,
                userAgent: metadata?.userAgent,
            }, { revokeExisting: false });
            return {
                restoredImpersonator: true,
                returnUrl: sanitizeRelativeRedirectUrl(verified.impersonatorReturnUrl),
            };
        }
    }

    writeEmptySessionCookieToStore(cookieStore);
    return { restoredImpersonator: false };
}
