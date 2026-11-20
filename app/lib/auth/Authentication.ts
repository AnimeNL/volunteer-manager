// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { AuthenticationContext, UserAuthenticationContext } from './AuthenticationContextTypes';
import type { LegacySessionData } from './Session';
import type { User } from './User';
import { AccessControl, type Grant } from './access/AccessControl';
import { getBlobUrl } from '../database/BlobStore';
import db, { tEvents, tRoles, tStorage, tTeams, tUsers, tUsersEvents } from '../database';

import { kAuthType, kRegistrationStatus } from '../database/Types';

/**
 * Row shape returned by the user authentication query in `authenticateUser()`. Exported for
 * test helpers that mock the query.
 */
export interface AuthenticationResult {
    // AuthenticationContext.accessControl:
    accessControl?: {
        grants?: string;
        revokes?: string;
        events?: string;
        teams?: string;
    };

    // UserAuthenticationContext.events:
    events: {
        event?: string;
        grant?: string;
        team?: string;
        isEventHidden?: number;
    }[];

    // UserAuthenticationContext.user:
    userId: number;
    username?: string;
    firstName: string;
    lastName: string;
    displayName?: string;
    avatarFileHash?: string;
}

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

    const authType = kAuthType.password;
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
