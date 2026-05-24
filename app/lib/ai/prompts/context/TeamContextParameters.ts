// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { DBConnection } from '@lib/database/Connection';
import { tEnvironments, tTeams } from '@lib/database';

/**
 * Parameters relaying context about the team relating to the message that's been generated.
 */
export type TeamContextParameters<FieldName extends string = 'team'> = {
    [K in FieldName]: {
        description: string;
        domain: string;
        slug: string;
        title: string;
    };
};

/**
 * Example parameters that convey information about the team relating to the generated message.
 */
export const kTeamContextExampleParameters: TeamContextParameters['team'] = {
    description: 'Stewards are the first line of defense when trouble arises.',
    domain: 'stewards.team',
    slug: 'stewards',
    title: 'Steward Team',
};

/**
 * Alternative example parameters to convey information about the team relating to the message.
 */
export const kTeamContextAlternativeExampleParameters: TeamContextParameters['team'] = {
    description: 'Crew are responsible for delivering an incredible experience to our visitors.',
    domain: 'animecon.team',
    slug: 'crew',
    title: 'Volunteering Crew',
};

/**
 * Queries the team context for the given `teamId`. Will throw an exception when the given `teamId`
 * does not exist.
 */
export async function queryTeamContext(db: DBConnection, teamId: number)
    : Promise<TeamContextParameters['team']>
{
    return db.selectFrom(tTeams)
        .innerJoin(tEnvironments)
            .on(tEnvironments.environmentId.equals(tTeams.teamEnvironmentId))
        .where(tTeams.teamId.equals(teamId))
        .select({
            description: tTeams.teamDescription,
            domain: tEnvironments.environmentDomain,
            slug: tTeams.teamSlug,
            title: tTeams.teamTitle,
        })
        .executeSelectOne();
}
