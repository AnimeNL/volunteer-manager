// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { DBConnection } from '@lib/database/Connection';
import { tActivities, tTeams, tUsers, tUsersEvents } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Parameters relaying context about the recipient of the message that's been generated.
 */
export type RecipientContextParameters<FieldName extends string = 'recipient'> = {
    [K in FieldName]: {
        name: string;
    };
};

/**
 * Example parameters that convey information about the intended recipient of a message.
 */
export const kRecipientContextExampleParameters: RecipientContextParameters['recipient'] = {
    name: 'Amara Thompson',
};

/**
 * Queries the recipient context for the given `userId` from the database. Will throw an exception
 * when the given `userId` does not exist or has been anonymised.
 */
export async function queryRecipientContext(db: DBConnection, userId: number)
    : Promise<RecipientContextParameters['recipient']>
{
    const name = await db.selectFrom(tUsers)
        .where(tUsers.userId.equals(userId))
            .and(tUsers.anonymized.isNull())
        .selectOneColumn(tUsers.name)
        .executeSelectOne();

    return { name };
}

/**
 * Queries the recipient context for the owner of the given `activityId`. Will throw an exception
 * when the given `activityId` does not exist, has been deleted, or has no known owner.
 */
export async function queryActivityRecipientContext(db: DBConnection, activityId: number)
    : Promise<RecipientContextParameters['recipient']>
{
    const name = await db.selectFrom(tActivities)
        .where(tActivities.activityId.equals(activityId))
            .and(tActivities.activityDeleted.isNull())
            .and(tActivities.activityReportToName.isNotNull())
        .selectOneColumn(tActivities.activityReportToName)
        .executeSelectOne();

    return { name: name! };
}

/**
 * Queries the other teams in which the given `userId` is actively participating (i.e. accepted)
 * during the given `eventId`, excluding `teamId`. Returns a comma-separated list of team titles,
 * or `undefined` when they are not participating in any other teams.
 */
export async function queryRecipientOtherTeams(
    db: DBConnection, userId: number, eventId: number, teamId: number): Promise<string | undefined>
{
    const teams = await db.selectFrom(tUsersEvents)
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tUsersEvents.teamId))
        .where(tUsersEvents.userId.equals(userId))
            .and(tUsersEvents.eventId.equals(eventId))
            .and(tUsersEvents.teamId.notEquals(teamId))
            .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
        .selectOneColumn(tTeams.teamTitle)
        .orderBy(tTeams.teamTitle, 'asc')
        .executeSelectMany();

    return teams.length > 0 ? teams.join(', ') : undefined;
}
