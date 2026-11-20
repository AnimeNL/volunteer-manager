// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';
import { headers } from 'next/headers';

import { hashPassword } from './Password';
import { normalizeClientIp } from './RateLimit';
import { revokeAllUserSessions } from './SessionStore';
import db, { tUsers, tUsersAuth, tUsersPasskeys } from '../database';

import { kAuthType } from '../database/Types';

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

/**
 * Input required to create a new unactivated user account with an Argon2id password hash.
 */
export interface CreateAccountWithPasswordData {
    username: string;
    password: string;
    firstName: string;
    lastName: string;
    gender: string;
    birthdate: string;
    phoneNumber: string;
    discordHandle?: string;
}

/**
 * Creates a new unactivated account and stores an Argon2id hash of `data.password` in `users_auth`.
 */
export async function createAccountWithPassword(
    data: CreateAccountWithPasswordData): Promise<number | undefined>
{
    const hashedPassword = await hashPassword(data.password);
    let userId: number | undefined;

    const dbInstance = db;
    await dbInstance.transaction(async () => {
        userId = await dbInstance.insertInto(tUsers)
            .set({
                username: data.username,
                firstName: data.firstName,
                lastName: data.lastName,
                gender: data.gender,
                birthdate: Temporal.PlainDate.from(data.birthdate),
                phoneNumber: data.phoneNumber,
                discordHandle: data.discordHandle || null,
                discordHandleUpdated:
                    data.discordHandle ? dbInstance.currentZonedDateTime() : null,
            })
            .returningLastInsertedId()
            .executeInsert();

        await dbInstance.insertInto(tUsersAuth)
            .set({
                userId,
                authType: kAuthType.password,
                authValue: hashedPassword,
            })
            .executeInsert();
    });

    return userId;
}

/**
 * Options controlling session invalidation when replacing a user's password.
 */
export interface SetUserPasswordOptions {
    revokeSessions?: boolean;
    exceptSessionId?: number;
}

/**
 * Replaces the password (and removes any one-time access code) for `userId` with an Argon2id hash
 * of `plaintextPassword`. Optionally rotates `session_token` and revokes existing sessions.
 */
export async function setUserPassword(
    userId: number, plaintextPassword: string, options?: SetUserPasswordOptions): Promise<void>
{
    const hashedPassword = await hashPassword(plaintextPassword);

    const dbInstance = db;
    await dbInstance.transaction(async () => {
        await dbInstance.deleteFrom(tUsersAuth)
            .where(tUsersAuth.userId.equals(userId))
                .and(tUsersAuth.authType.in([ kAuthType.code, kAuthType.password ]))
            .executeDelete();

        await dbInstance.insertInto(tUsersAuth)
            .values({
                userId,
                authType: kAuthType.password,
                authValue: hashedPassword,
            })
            .executeInsert();

        if (options?.revokeSessions) {
            await dbInstance.update(tUsers)
                .set({ sessionToken: tUsers.sessionToken.add(1) })
                .where(tUsers.userId.equals(userId))
                .executeUpdate(/* min= */ 0, /* max= */ 1);
        }
    });

    if (options?.revokeSessions)
        await revokeAllUserSessions(userId, options.exceptSessionId);
}

/**
 * Stored passkey credential metadata for a single Relying Party ID.
 */
export interface StoredPasskeyCredential {
    passkeyId: number;
    name?: string;
    credentialId: Uint8Array<ArrayBuffer>;
    credentialPublicKey: Uint8Array<ArrayBuffer>;
    counter: bigint;
    created: Temporal.ZonedDateTime;
    lastUsed?: Temporal.ZonedDateTime;
}

/**
 * Retrieves all WebAuthn passkeys registered to `userId` for the given `rpId`.
 */
export async function retrieveUserPasskeys(
    userId: number, rpId: string): Promise<StoredPasskeyCredential[]>
{
    return db.selectFrom(tUsersPasskeys)
        .select({
            passkeyId: tUsersPasskeys.userPasskeyId,
            name: tUsersPasskeys.credentialName,
            credentialId: tUsersPasskeys.credentialId,
            credentialPublicKey: tUsersPasskeys.credentialPublicKey,
            counter: tUsersPasskeys.counter,
            created: tUsersPasskeys.credentialCreated,
            lastUsed: tUsersPasskeys.credentialLastUsed,
        })
        .where(tUsersPasskeys.userId.equals(userId))
            .and(tUsersPasskeys.credentialRpid.equals(rpId))
        .orderBy(tUsersPasskeys.credentialLastUsed, 'desc nulls last')
            .orderBy(tUsersPasskeys.credentialCreated, 'asc')
        .executeSelectMany();
}

/**
 * Updates the signature counter and last-used timestamp for a verified passkey.
 */
export async function updatePasskeyCounter(
    userId: number, passkeyId: number, counter: bigint): Promise<void>
{
    const dbInstance = db;
    await dbInstance.update(tUsersPasskeys)
        .set({
            credentialLastUsed: dbInstance.currentZonedDateTime(),
            counter,
        })
        .where(tUsersPasskeys.userId.equals(userId))
            .and(tUsersPasskeys.userPasskeyId.equals(passkeyId))
        .executeUpdate();
}
