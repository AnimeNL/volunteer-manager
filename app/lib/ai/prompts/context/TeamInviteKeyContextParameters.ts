// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { DBConnection } from '@lib/database/Connection';
import { generateInviteKey } from '@lib/EnvironmentContext';
import { tEvents, tTeams } from '@lib/database';

/**
 * Parameters relaying context about the invite key necessary to apply to join a certain team.
 */
export type TeamInviteKeyContextParameters<FieldName extends string = 'teamInviteKey'> = {
    [K in FieldName]?: string;
};

/**
 * Example parameters that convey the invitation key.
 */
export const kTeamInviteKeyContextExampleParameters = '06a31d3b60c77db5';

/**
 * Queries the team invite key for the given `eventId` and `teamId`. Will throw an exception when
 * the given `teamId` does not exist. Will return `null` when the team is the primary team for its
 * environment, in which case the key is optional.
 */
export async function queryTeamInviteKeyContext(db: DBConnection, eventId: number, teamId: number)
    : Promise<TeamInviteKeyContextParameters['teamInviteKey']>
{
    const { eventSlug, teamInviteKey, teamManagesContent } = await db.selectFrom(tEvents)
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(teamId))
        .where(tEvents.eventId.equals(eventId))
        .select({
            eventSlug: tEvents.eventSlug,
            teamInviteKey: tTeams.teamInviteKey,
            teamManagesContent: tTeams.teamFlagManagesContent,
        })
        .executeSelectOne();

    return !!teamManagesContent ? undefined
                                :generateInviteKey(eventSlug, teamInviteKey);
}
