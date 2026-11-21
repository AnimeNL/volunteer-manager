// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';
import type { VerifiedRegistrationResponse } from '@simplewebauthn/server';

import db, { tUsersPasskeys } from '../database';

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
            .and(tUsersPasskeys.counter.lessOrEqual(counter))
        .executeUpdate();
}

type PasskeyRegistrationInfo = NonNullable<VerifiedRegistrationResponse['registrationInfo']>;

/**
 * Stores a newly verified WebAuthn passkey registration for `userId` under `rpId`.
 */
export async function storeUserPasskey(
    userId: number, rpId: string, name: string | undefined, registration: PasskeyRegistrationInfo)
        : Promise<void>
{
    await db.insertInto(tUsersPasskeys)
        .set({
            userId,
            credentialId: Buffer.from(registration.credential.id, 'base64url'),
            credentialRpid: rpId,
            credentialFormat: registration.fmt,
            credentialName: name || null,
            credentialOrigin: registration.origin,
            credentialPublicKey: Buffer.from(registration.credential.publicKey),
            credentialDeviceType: registration.credentialDeviceType,
            credentialBackedUp: registration.credentialBackedUp ? 1 : 0,
            credentialTransport: registration.credential.transports?.join(', ') ?? null,
            counter: BigInt(registration.credential.counter),
        })
        .executeInsert();
}

/**
 * Deletes a registered passkey owned by `userId`. Returns whether a row was removed.
 */
export async function deleteUserPasskey(userId: number, passkeyId: number): Promise<boolean> {
    return await db.deleteFrom(tUsersPasskeys)
        .where(tUsersPasskeys.userId.equals(userId))
            .and(tUsersPasskeys.userPasskeyId.equals(passkeyId))
        .executeDelete() > 0;
}
