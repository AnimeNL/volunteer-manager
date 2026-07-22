// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { DBConnection } from '@lib/database/Connection';
import { tEnvironments, tEventsTeams, tRoles, tTeams, tTeamsRoles } from '@lib/database';

/**
 * Parameters relaying context about the team relating to the message that's been generated.
 */
export type TeamContextParameters<FieldName extends string = 'team'> = {
    [K in FieldName]: {
        description: string;
        domain: string;
        flagRequestConfirmation: boolean;
        roleHotelEligible: boolean;
        roleTrainingEligible: boolean;
        slug: string;
        title: string;
        whatsApp?: string;
    };
};

/**
 * Example parameters that convey information about the team relating to the generated message.
 */
export const kTeamContextExampleParameters: TeamContextParameters['team'] = {
    description: 'Stewards are the first line of defense when trouble arises.',
    domain: 'stewards.team',
    flagRequestConfirmation: true,
    roleHotelEligible: true,
    roleTrainingEligible: true,
    slug: 'stewards',
    title: 'Steward Team',
    whatsApp: 'https://chat.whatsapp.com/MyGroupId',
};

/**
 * Alternative example parameters to convey information about the team relating to the message.
 */
export const kTeamContextAlternativeExampleParameters: TeamContextParameters['team'] = {
    description: 'Crew are responsible for delivering an incredible experience to our visitors.',
    domain: 'animecon.team',
    flagRequestConfirmation: false,
    roleHotelEligible: false,
    roleTrainingEligible: false,
    slug: 'crew',
    title: 'Volunteering Crew',
    whatsApp: undefined,
};

/**
 * Queries the team context for the given `teamId`. Will throw an exception when the given `teamId`
 * does not exist.
 */
export async function queryTeamContext(db: DBConnection, eventId: number, teamId: number)
    : Promise<TeamContextParameters['team']>
{
    const eventsTeamsJoin = tEventsTeams.forUseInLeftJoin();

    return db.selectFrom(tTeams)
        .innerJoin(tEnvironments)
            .on(tEnvironments.environmentId.equals(tTeams.teamEnvironmentId))
        .innerJoin(tTeamsRoles)
            .on(tTeamsRoles.teamId.equals(tTeams.teamId))
                .and(tTeamsRoles.roleDefault.equals(/* true= */ 1))
        .innerJoin(tRoles)
            .on(tRoles.roleId.equals(tTeamsRoles.roleId))
        .leftJoin(eventsTeamsJoin)
            .on(eventsTeamsJoin.eventId.equals(eventId))
                .and(eventsTeamsJoin.teamId.equals(teamId))
                .and(eventsTeamsJoin.enableTeam.equals(/* true= */ 1))
        .where(tTeams.teamId.equals(teamId))
        .select({
            description: tTeams.teamDescription,
            domain: tEnvironments.environmentDomain,
            flagRequestConfirmation: tTeams.teamFlagRequestConfirmation.equals(/* true= */ 1),
            roleHotelEligible: tRoles.roleHotelEligible.equals(/* true= */ 1),
            roleTrainingEligible: tRoles.roleTrainingEligible.equals(/* true= */ 1),
            slug: tTeams.teamSlug,
            title: tTeams.teamTitle,
            whatsApp: eventsTeamsJoin.whatsappLink,
        })
        .executeSelectOne();
}
