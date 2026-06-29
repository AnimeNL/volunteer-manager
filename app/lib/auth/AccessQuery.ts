// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { AccessControl, type Grant } from './AccessControl';
import { checkPermission, type PermissionAccessCheck } from './AuthenticationContext';
import db, { tEvents, tRoles, tTeams, tUsersEvents, tUsers } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Type that describes the user information returned from an access query.
 */
type UserResult = {
    /**
     * The user's unique ID through which they've been identified in the database.
     */
    id: number;

    /**
     * The user's display name or full name through which they're known.
     */
    name: string;
};

/**
 * Queries all users in the Volunteer Manager to identify those who have the `permission` granted to
 * their account, irrespective of how it has been granted. This function executes a database query
 * to fetch the necessary information from the database.
 */
export async function queryUsersWithPermission(permission: PermissionAccessCheck)
    : Promise<UserResult[]>
{
    const dbInstance = db;

    const eventsJoin = tEvents.forUseInLeftJoin();
    const rolesJoin = tRoles.forUseInLeftJoin();
    const teamsJoin = tTeams.forUseInLeftJoin();
    const usersEventsJoin = tUsersEvents.forUseInLeftJoin();

    const users = await dbInstance.selectFrom(tUsers)
        .leftJoin(usersEventsJoin)
            .on(usersEventsJoin.userId.equals(tUsers.userId))
                .and(usersEventsJoin.registrationStatus.equals(kRegistrationStatus.Accepted))
        .leftJoin(eventsJoin)
            .on(eventsJoin.eventId.equals(usersEventsJoin.eventId))
                .and(eventsJoin.eventHidden.equals(/* false= */ 0))
        .leftJoin(rolesJoin)
            .on(rolesJoin.roleId.equals(usersEventsJoin.roleId))
        .leftJoin(teamsJoin)
            .on(teamsJoin.teamId.equals(usersEventsJoin.teamId))
        .select({
            user: {
                id: tUsers.userId,
                name: tUsers.name,
            },
            access: {
                grants: tUsers.permissionsGrants,
                revokes: tUsers.permissionsRevokes,
                events: tUsers.permissionsEvents,
                teams: tUsers.permissionsTeams,
            },
            events: dbInstance.aggregateAsArray({
                permission: rolesJoin.rolePermissionGrant,
                event: eventsJoin.eventSlug,
                team: teamsJoin.teamSlug,
            }),
        })
        .groupBy(tUsers.userId)
        .executeSelectMany();

    return users.filter(user => {
        if (!user.access && !user.events.length)
            return false;  // the user has no access information

        const grants: Grant[] = user.access?.grants ? [ user.access.grants ] : [ /* empty */ ];
        for (const eventGrant of user.events) {
            if (!eventGrant.event)
                continue;  // the right of this event are not applicable anymore

            if (!eventGrant.permission)
                continue;  // they had no permission-granting role in this event

            grants.push(eventGrant as Grant);
        }

        const access = new AccessControl({
            grants,
            revokes: user.access?.revokes,
            events: user.access?.events,
            teams: user.access?.teams,
        });

        return checkPermission(access, permission);

    }).map(user => user.user);
}
