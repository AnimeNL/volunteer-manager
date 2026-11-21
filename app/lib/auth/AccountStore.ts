// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';
import crypto from 'node:crypto';

import { hashPassword, verifyPassword } from './Password';
import { revokeAllUserSessions } from './SessionStore';
import { sealPasswordResetRequest } from './Tokens';
import db, { tUsers, tUsersAuth } from '../database';

import { kAuthType } from '../database/Types';

/**
 * Result of verifying a user's plaintext password or one-time access code.
 */
export type CredentialVerificationResult =
    { authenticated: false } |
    { authenticated: true; authType: 'code' | 'password'; userId: number };

/**
 * Compares a plaintext access code against a stored code value (either Argon2id-hashed or legacy
 * plaintext) in constant time.
 */
async function verifyAccessCode(plaintext: string, storedValue: string): Promise<boolean> {
    if (storedValue.startsWith('$argon2id$'))
        return (await verifyPassword(plaintext, storedValue)).valid;

    const inputBuffer = Buffer.from(plaintext, 'utf8');
    const storedBuffer = Buffer.from(storedValue, 'utf8');
    if (inputBuffer.length !== storedBuffer.length)
        return false;

    return crypto.timingSafeEqual(inputBuffer, storedBuffer);
}

/**
 * Silently upgrades a user's legacy password hash to Argon2id. Matches on the previous hash value
 * so a concurrent password change or reset is never overwritten.
 */
async function upgradeUserPasswordHash(
    userId: number, previousHash: string, plaintextPassword: string): Promise<void>
{
    const upgradedHash = await hashPassword(plaintextPassword);
    await db.update(tUsersAuth)
        .set({ authValue: upgradedHash })
        .where(tUsersAuth.userId.equals(userId))
            .and(tUsersAuth.authType.equals(kAuthType.password))
            .and(tUsersAuth.authValue.equals(previousHash))
        .executeUpdate();
}

/**
 * Verifies a plaintext `password` (or one-time access code) for the activated, non-anonymized user
 * identified by `username`. Silently upgrades legacy password hashes to Argon2id on success.
 */
export async function verifyUserCredentials(
    username: string, plaintextPassword: string): Promise<CredentialVerificationResult>
{
    const userId = await db.selectFrom(tUsers)
        .where(tUsers.username.equals(username))
            .and(tUsers.activated.equals(/* true= */ 1))
            .and(tUsers.anonymized.isNull())
        .selectOneColumn(tUsers.userId)
        .executeSelectNoneOrOne();

    if (!userId)
        return { authenticated: false };

    const credentials = await db.selectFrom(tUsersAuth)
        .where(tUsersAuth.userId.equals(userId))
            .and(tUsersAuth.authType.in([ kAuthType.password, kAuthType.code ]))
        .select({
            authType: tUsersAuth.authType,
            authValue: tUsersAuth.authValue,
        })
        .executeSelectMany();

    for (const credential of credentials) {
        if (credential.authType === kAuthType.password) {
            const result = await verifyPassword(plaintextPassword, credential.authValue);
            if (!result.valid)
                continue;

            if (result.needsUpgrade)
                await upgradeUserPasswordHash(userId, credential.authValue, plaintextPassword);

            return { authenticated: true, authType: 'password', userId };
        }

        if (credential.authType === kAuthType.code) {
            if (await verifyAccessCode(plaintextPassword, credential.authValue))
                return { authenticated: true, authType: 'code', userId };
        }
    }

    return { authenticated: false };
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
 * Returns the current session token for `userId`, or `null` if the user does not exist.
 */
async function getUserSessionToken(userId: number): Promise<number | null> {
    return db.selectFrom(tUsers)
        .where(tUsers.userId.equals(userId))
        .selectOneColumn(tUsers.sessionToken)
        .executeSelectNoneOrOne();
}

type ValidUserData = { id: number; activated: boolean };

/**
 * Returns whether the given `username` belongs to an activated account.
 */
export async function isValidActivatedUser(username: string): Promise<ValidUserData | undefined> {
    return await db.selectFrom(tUsers)
        .select({
            id: tUsers.userId,
            activated: tUsers.activated.equals(/* true= */ 1)
        })
        .where(tUsers.username.equals(username))
            .and(tUsers.anonymized.isNull())
        .executeSelectNoneOrOne() ?? undefined;
}

/**
 * Returns whether the given `username` is available.
 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
    const user = await db.selectFrom(tUsers)
        .select({ userId: tUsers.userId })
        .where(tUsers.username.equals(username))
        .executeSelectNoneOrOne();

    return !user;
}

/**
 * Unambiguous 32-character alphabet used for one-time access codes (excludes 0/O and 1/I/L).
 */
const kAccessCodeAlphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Generates an 8-character cryptographically random access code formatted as `XXXX-XXXX` (40 bits
 * of entropy).
 */
function generateAccessCode(): string {
    const pick = () => kAccessCodeAlphabet[crypto.randomInt(kAccessCodeAlphabet.length)];
    return `${pick()}${pick()}${pick()}${pick()}-${pick()}${pick()}${pick()}${pick()}`;
}

/**
 * Generates a new one-time access code for `userId`, replaces any existing code with its Argon2id
 * hash in `users_auth`, and returns the plaintext code (or `undefined` on failure).
 */
export async function createUserAccessCode(userId: number): Promise<string | undefined> {
    const accessCode = generateAccessCode();
    const hashedAccessCode = await hashPassword(accessCode);

    const dbInstance = db;
    const inserted = await dbInstance.transaction(async () => {
        await dbInstance.deleteFrom(tUsersAuth)
            .where(tUsersAuth.userId.equals(userId))
                .and(tUsersAuth.authType.equals(kAuthType.code))
            .executeDelete();

        return dbInstance.insertInto(tUsersAuth)
            .values({
                userId,
                authType: kAuthType.code,
                authValue: hashedAccessCode,
            })
            .executeInsert();
    });

    return inserted ? accessCode : undefined;
}

/**
 * Creates a sealed password-reset token for `userId`, or returns `undefined` if the user does not
 * exist.
 */
export async function createPasswordResetToken(userId: number): Promise<string | undefined> {
    const sessionToken = await getUserSessionToken(userId);
    if (sessionToken === null)
        return undefined;

    return sealPasswordResetRequest({ id: userId, token: sessionToken });
}
