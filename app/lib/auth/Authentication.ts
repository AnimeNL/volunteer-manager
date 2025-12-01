// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { AuthenticationContext, UserAuthenticationContext } from './AuthenticationContext';
import type { AuthenticationResult } from './AuthenticationTestHelpers';
import type { SessionData } from './Session';
import type { User } from './User';
import { AccessControl, type Grant } from './AccessControl';
import { PlaywrightHooks } from '../PlaywrightHooks';
import { Temporal } from '@lib/Temporal';
import { getBlobUrl } from '../database/BlobStore';
import { securePasswordHash } from './Password';
import db, { tEvents, tRoles, tStorage, tTeams, tUsers, tUsersAuth, tUsersEvents }
    from '../database';

import { kAuthType, kRegistrationStatus } from '../database/Types';

/**
 * Interface containing all the information that must be known when creating a new account.
 */
interface AccountCreationData {
    /**
     * The username of the account that should be created.
     */
    username: string;

    /**
     * The password associated with that account, SHA256 hashed.
     */
    password: string;

    /**
     * The user's first name.
     */
    firstName: string;

    /**
     * The user's last name.
     */
    lastName: string;

    /**
     * Gender of the user. A string because we don't care.
     */
    gender: string;

    /**
     * Date on which the user was born. (YYYY-MM-DD)
     */
    birthdate: string;

    /**
     * Phone number of the user, in an undefined format.
     */
    phoneNumber: string;

    /**
     * Discord handle owned by the user, when provided, in an undefined format.
     */
    discordHandle?: string;
}

/**
 * Type of input that can be used to authenticate users. Used by `authenticateUser()`.
 */
export type AuthenticateUserParams =
    { type: 'password', username: string, sha256Password: string } |
    { type: 'session' } & SessionData |
    { type: 'userId', userId: number };

/**
 * Attempts to authenticate the user based on the given authentication `type` and `params`. An
 * instance of the `User` class will be returned when the given information was correct, whereas
 * `undefined` will be returned when something went wrong.
 */
export async function authenticateUser(params: AuthenticateUserParams)
    : Promise<AuthenticationContext>
{
    if (PlaywrightHooks.isActive())
        return PlaywrightHooks.authenticateUser(params);

    const eventsJoin = tEvents.forUseInLeftJoin();
    const rolesJoin = tRoles.forUseInLeftJoin();
    const storageJoin = tStorage.forUseInLeftJoin();
    const teamsJoin = tTeams.forUseInLeftJoin();
    const usersEventsJoin = tUsersEvents.forUseInLeftJoin();

    const dbInstance = db;
    const authenticationBaseSelect = dbInstance.selectFrom(tUsers)
        .innerJoin(tUsersAuth)
            .on(tUsersAuth.userId.equals(tUsers.userId))
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
            .on(rolesJoin.roleId.equals(usersEventsJoin.roleId))
        .groupBy(tUsers.userId)
        .select({
            // AuthenticationContext.accessControl:
            accessControl: {
                grants: tUsers.permissionsGrants,
                revokes: tUsers.permissionsRevokes,
                events: tUsers.permissionsEvents,
                teams: tUsers.permissionsTeams,
            },

            // UserAuthenticationContext.authType:
            authType: tUsersAuth.authType,

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
        });

    let authenticationQuery: ReturnType<typeof authenticationBaseSelect['executeSelectNoneOrOne']>;

    switch (params.type) {
        case 'password': {
            const securelyHashedPassword = await securePasswordHash(params.sha256Password);
            authenticationQuery = authenticationBaseSelect
                .where(tUsers.username.equals(params.username))
                    .and(tUsers.activated.equals(/* true= */ 1))
                    .and(tUsersAuth.authType.equals(kAuthType.password)
                             .and(tUsersAuth.authValue.equals(securelyHashedPassword))
                        .or(tUsersAuth.authType.equals(kAuthType.code)
                                .and(dbInstance.fragmentWithType('boolean', 'required').sql`
                                    SHA2(${tUsersAuth.authValue}, 256) =
                                         ${dbInstance.const(params.sha256Password, 'string')}`))
                    )
                .executeSelectNoneOrOne();

            break;
        }

        case 'session':
            authenticationQuery = authenticationBaseSelect
                .where(tUsers.userId.equals(params.id))
                    .and(tUsers.sessionToken.equals(params.token))
                .executeSelectNoneOrOne();

            break;

        case 'userId':
            authenticationQuery = authenticationBaseSelect
                .where(tUsers.userId.equals(params.userId))
                .executeSelectNoneOrOne();

            break;

        default:
            throw new Error('Invalid authentication type was provided');
    }

    const authenticationResult: AuthenticationResult | null = await authenticationQuery;
    if (!authenticationResult) {
        return {
            access: new AccessControl({ /* no grants */ }),
            user: /* guest= */ undefined,
        };
    }

    const authType = authenticationResult.authType;
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

type UserLike = { id: number };

/**
 * Returns the current session token from the `user`. This is a value that's quite important to the
 * security of their account, so it won't be included in the regular User type.
 */
export async function getUserSessionToken(user: UserLike | number): Promise<number | null> {
    if (PlaywrightHooks.isActive())
        return PlaywrightHooks.getUserSessionToken(user);

    return db.selectFrom(tUsers)
        .where(tUsers.userId.equals(typeof user === 'number' ? user : user.id))
        .selectOneColumn(tUsers.sessionToken)
        .executeSelectNoneOrOne();
}

/**
 * Creates an account based on the given `data`. Will return a number indicating user ID when the
 * account was created successfully, or undefined. Failure only happens when the SQL queries fail.
 */
export async function createAccount(data: AccountCreationData): Promise<number | undefined> {
    let userId: number | undefined;

    const dbInstance = db;
    await dbInstance.transaction(async () => {
        const securelyHashedPassword = await securePasswordHash(data.password);

        userId = await dbInstance.insertInto(tUsers)
            .set({
                username: data.username,
                firstName: data.firstName,
                lastName: data.lastName,
                gender: data.gender,
                birthdate: Temporal.PlainDate.from(data.birthdate),
                phoneNumber: data.phoneNumber,
                discordHandle: data.discordHandle,
                discordHandleUpdated:
                    !!data.discordHandle ? dbInstance.currentZonedDateTime()
                                         : null
            })
            .returningLastInsertedId()
            .executeInsert();

        await dbInstance.insertInto(tUsersAuth)
            .set({
                userId: userId,
                authType: kAuthType.password,
                authValue: securelyHashedPassword,
            })
            .executeInsert();
    });

    return userId;
}

type ValidUserData = { id: number; activated: boolean };

/**
 * Returns whether the given `username` belongs to an activated account.
 */
export async function isValidActivatedUser(username: string): Promise<ValidUserData | undefined> {
    if (PlaywrightHooks.isActive())
        return PlaywrightHooks.isUserActivated(username);

    return await db.selectFrom(tUsers)
        .select({
            id: tUsers.userId,
            activated: tUsers.activated.equals(/* true= */ 1)
        })
        .where(tUsers.username.equals(username))
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
