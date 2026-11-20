// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import crypto from 'node:crypto';

import type { AuthenticationContext, UserAuthenticationContext } from './AuthenticationContextTypes';
import type { AuthenticationResult } from './AuthenticationTestHelpers';
import type { LegacySessionData } from './Session';
import type { User } from './User';
import { AccessControl, type Grant } from './access/AccessControl';
import { getBlobUrl } from '../database/BlobStore';
import { hashPassword, verifyPassword } from './Password';
import db, { tEvents, tRoles, tStorage, tTeams, tUsers, tUsersAuth, tUsersEvents }
    from '../database';

import { kAuthType, kRegistrationStatus } from '../database/Types';

/**
 * Type of input that can be used to authenticate users. Used by `authenticateUser()`.
 */
type AuthenticateUserParams =
    { type: 'session' } & LegacySessionData |
    { type: 'userId', userId: number };

/**
 * Attempts to authenticate the user based on the given authentication `type` and `params`. An
 * instance of the `User` class will be returned when the given information was correct, whereas
 * `undefined` will be returned when something went wrong.
 */
export async function authenticateUser(params: AuthenticateUserParams)
    : Promise<AuthenticationContext>
{
    const eventsJoin = tEvents.forUseInLeftJoin();
    const rolesJoin = tRoles.forUseInLeftJoin();
    const storageJoin = tStorage.forUseInLeftJoin();
    const teamsJoin = tTeams.forUseInLeftJoin();
    const usersEventsJoin = tUsersEvents.forUseInLeftJoin();

    const dbInstance = db;
    const baseUserSelect = {
        // AuthenticationContext.accessControl:
        accessControl: {
            grants: tUsers.permissionsGrants,
            revokes: tUsers.permissionsRevokes,
            events: tUsers.permissionsEvents,
            teams: tUsers.permissionsTeams,
        },

        // UserAuthenticationContext.events:
        events: dbInstance.aggregateAsArray({
            event: eventsJoin.eventSlug,
            grant: rolesJoin.rolePermissionGrant,
            team: teamsJoin.teamSlug,

            // TODO: Figure out if we can do this filtering in the query somehow...
            isEventHidden: eventsJoin.eventHidden,
        }),

        // UserAuthenticationContext.user:
        userId: tUsers.userId,
        username: tUsers.username,
        firstName: tUsers.firstName,
        lastName: tUsers.lastName,
        displayName: tUsers.displayName,
        avatarFileHash: storageJoin.fileHash,
    };

    const userSelectFrom = dbInstance.selectFrom(tUsers)
        .leftJoin(storageJoin)
            .on(storageJoin.fileId.equals(tUsers.avatarId))
        .leftJoin(usersEventsJoin)
            .on(usersEventsJoin.userId.equals(tUsers.userId))
            .and(usersEventsJoin.registrationStatus.equals(kRegistrationStatus.Accepted))
        .leftJoin(eventsJoin)
            .on(eventsJoin.eventId.equals(usersEventsJoin.eventId))
        .leftJoin(teamsJoin)
            .on(teamsJoin.teamId.equals(usersEventsJoin.teamId))
        .leftJoin(rolesJoin)
            .on(rolesJoin.roleId.equals(usersEventsJoin.roleId));

    let authenticationResult: AuthenticationResult | null;

    switch (params.type) {
        case 'session':
            authenticationResult = await userSelectFrom
                .groupBy(tUsers.userId)
                .select(baseUserSelect)
                .where(tUsers.userId.equals(params.id))
                    .and(tUsers.sessionToken.equals(params.token))
                    .and(tUsers.activated.equals(/* true= */ 1))
                    .and(tUsers.anonymized.isNull())
                .executeSelectNoneOrOne();

            break;

        case 'userId':
            authenticationResult = await userSelectFrom
                .groupBy(tUsers.userId)
                .select(baseUserSelect)
                .where(tUsers.userId.equals(params.userId))
                    .and(tUsers.activated.equals(/* true= */ 1))
                    .and(tUsers.anonymized.isNull())
                .executeSelectNoneOrOne();

            break;

        default:
            throw new Error('Invalid authentication type was provided');
    }

    if (!authenticationResult) {
        return {
            access: new AccessControl({ /* no grants */ }),
            user: /* guest= */ undefined,
        };
    }

    const authType = authenticationResult.authType ?? kAuthType.password;
    const events: UserAuthenticationContext['events'] = new Map();
    const user: User = {
        id: authenticationResult.userId,
        username: authenticationResult.username,
        name: authenticationResult.displayName ||
            `${authenticationResult.firstName} ${authenticationResult.lastName}`,
        nameOrFirstName:authenticationResult.displayName || authenticationResult.firstName,
        firstName: authenticationResult.firstName,
        lastName: authenticationResult.lastName,
        displayName: authenticationResult.displayName,
        avatarUrl:
            authenticationResult.avatarFileHash ? getBlobUrl(authenticationResult.avatarFileHash)
                                                : undefined,
    };

    const grants: Grant[] = [ /* no grants */ ];

    if (!!authenticationResult.accessControl?.grants)
        grants.push(authenticationResult.accessControl.grants);

    for (const entry of authenticationResult.events) {
        if (!entry.event || !entry.team)
            continue;  // incomplete data

        if (entry.isEventHidden)
            continue;  // the event has been suspended

        if (!!entry.grant) {
            grants.push({
                permission: entry.grant,
                event: entry.event,
                team: entry.team,
            });
        }

        events.set(entry.event, entry.team);
    }

    const accessControl = new AccessControl({
        grants,
        revokes: authenticationResult.accessControl?.revokes,
        events: authenticationResult.accessControl?.events,
        teams: authenticationResult.accessControl?.teams,
    });

    return { access: accessControl, authType, events, user };
}

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

type UserLike = { id: number };

/**
 * Returns the current session token from the `user`. This is a value that's quite important to the
 * security of their account, so it won't be included in the regular User type.
 */
export async function getUserSessionToken(user: UserLike | number): Promise<number | null> {
    return db.selectFrom(tUsers)
        .where(tUsers.userId.equals(typeof user === 'number' ? user : user.id))
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
