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
            impersonatorReturnUrl: params.impersonatorReturnUrl?.slice(0, 255) ?? null,
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

    if (!row)
        return undefined;

    const expectedHash = Buffer.from(row.sessionTokenHash, 'hex');
    const actualHash = Buffer.from(hashSessionSecret(secret), 'hex');
    if (expectedHash.length !== actualHash.length ||
        !crypto.timingSafeEqual(expectedHash, actualHash))
    {
        return undefined;
    }

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
 * Revokes a single device session by its `sessionId` and invalidates the user's auth cache.
 */
export async function revokeUserSession(sessionId: number, userId?: number): Promise<void> {
    await db.deleteFrom(tUsersSessions)
        .where(tUsersSessions.sessionId.equals(sessionId))
        .executeDelete();

    if (userId !== undefined)
        Cache.getInstance('Authentication').delete(userId);
}

/**
 * Revokes all sessions belonging to `userId` — including any impersonation sessions initiated by
 * `userId` — (optionally preserving `exceptSessionId` when a user changes their own password) and
 * invalidates the affected auth cache entries.
 */
export async function revokeAllUserSessions(
    userId: number, exceptSessionId?: number): Promise<void>
{
    const impersonatedUserIds = await db.selectDistinctFrom(tUsersSessions)
        .where(tUsersSessions.impersonatorUserId.equals(userId))
            .and(tUsersSessions.sessionId.notEqualsIfValue(exceptSessionId))
        .selectOneColumn(tUsersSessions.userId)
        .executeSelectMany();

    await db.deleteFrom(tUsersSessions)
        .where(tUsersSessions.userId.equals(userId)
            .or(tUsersSessions.impersonatorUserId.equals(userId)))
        .and(tUsersSessions.sessionId.notEqualsIfValue(exceptSessionId))
        .executeDelete();

    const authCache = Cache.getInstance('Authentication');
    authCache.delete(userId);
    for (const impersonatedUserId of impersonatedUserIds)
        authCache.delete(impersonatedUserId);
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
 * `cookieStore`.
 */
export async function createAndWriteUserSessionCookie(
    cookieStore: CookieStore, params: CreateSessionParams): Promise<CreatedSession>
{
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
        await revokeUserSession(session.sessionId, session.userId);

        if (verified?.impersonatorUserId && await isActiveUser(verified.impersonatorUserId)) {
            await createAndWriteUserSessionCookie(cookieStore, {
                userId: verified.impersonatorUserId,
                ip: metadata?.ip,
                userAgent: metadata?.userAgent,
            });
            return { restoredImpersonator: true, returnUrl: verified.impersonatorReturnUrl };
        }
    }

    writeEmptySessionCookieToStore(cookieStore);
    return { restoredImpersonator: false };
}
