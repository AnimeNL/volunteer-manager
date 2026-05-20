// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { DBConnection } from '@lib/database/Connection';
import { tEvents, tRoles, tTeams, tUsers, tUsersEvents } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Parameters relaying context about the author of the message that's been generated.
 */
export type AuthorContextParameters<FieldName extends string = 'author'> = {
    [K in FieldName]: {
        name: string;
        role: string;
        team: string;
    };
};

/**
 * Example parameters that convey information about the author of a message.
 */
export const kAuthorContextExampleParameters: AuthorContextParameters['author'] = {
    name: 'Julian Beaumont',
    role: 'Senior Crew',
    team: 'Volunteering Crew',
};

/**
 * Queries the author context for the given `userId` from the database. Their team and role will
 * be identified by the most recent event for which their application was accepted. Will throw an
 * exception when the given `userId` does not exist or has been anonymised.
 */
export async function queryAuthorContext(db: DBConnection, userId: number)
    : Promise<AuthorContextParameters['author']>
{
    const eventsJoin = tEvents.forUseInLeftJoin();
    const rolesJoin = tRoles.forUseInLeftJoin();
    const teamsJoin = tTeams.forUseInLeftJoin();
    const usersEventsJoin = tUsersEvents.forUseInLeftJoin();

    return await db.selectFrom(tUsers)
        .leftJoin(usersEventsJoin)
            .on(usersEventsJoin.userId.equals(tUsers.userId))
            .and(usersEventsJoin.registrationStatus.equals(kRegistrationStatus.Accepted))
        .leftJoin(eventsJoin)
            .on(eventsJoin.eventId.equals(usersEventsJoin.eventId))
        .leftJoin(rolesJoin)
            .on(rolesJoin.roleId.equals(usersEventsJoin.roleId))
        .leftJoin(teamsJoin)
            .on(teamsJoin.teamId.equals(usersEventsJoin.teamId))
        .where(tUsers.userId.equals(userId))
            .and(tUsers.anonymized.isNull())
        .select({
            name: tUsers.name,
            role: rolesJoin.roleName.valueWhenNull('Volunteer'),
            team: teamsJoin.teamTitle.valueWhenNull('AnimeCon'),
        })
        .orderBy(eventsJoin.eventStartTime, 'desc')
        .limit(1)
        .executeSelectOne();
}
