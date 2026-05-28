// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden, notFound } from 'next/navigation';
import { z } from 'zod/v4';

import type { ActionProps } from '../Action';
import type { ApiDefinition, ApiRequest, ApiResponse } from '../Types';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { SendEmailTask } from '@lib/scheduler/tasks/SendEmailTask';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { getEventBySlug } from '@lib/EventLoader';
import db, { tEventsTeams, tEvents, tTeamsRoles, tTeams, tUsersEvents, tUsers } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Interface definition for the Volunteer API, exposed through /api/admin/volunteer-teams.
 */
export const kVolunteerTeamsDefinition = z.object({
    request: z.object({
        /**
         * Unique slug of the event for which the team is being considered.
         */
        event: z.string(),

        /**
         * Unique ID of the user for whom the team is being considered.
         */
        userId: z.number(),

        /**
         * To be included when the team assignment should be updated. The volunteer's role will be
         * reset to the default role of the new team.
         */
        update: z.object({
            /**
             * The team that the volunteer currently is a member of.
             */
            currentTeam: z.string(),

            /**
             * The team that the volunteer should be moved to.
             */
            updatedTeam: z.string(),

            /**
             * Subject of the message to send to the volunteer to let them know about this change.
             */
            subject: z.string().optional(),

            /**
             * Message to send to the volunteer to let them know about this change. Optional.
             */
            message: z.string().optional(),

        }).optional(),
    }),
    response: z.strictObject({
        /**
         * Whether the API call was able to execute successfully.
         */
        success: z.boolean(),

        /**
         * Optional error message to inform the volunteer when something goes wrong.
         */
        error: z.string().optional(),

        /**
         * When successfully getting available teams, the teams the volunteer can select from.
         */
        teams: z.array(z.object({
            /**
             * Unique ID of the team.
             */
            teamId: z.number(),

            /**
             * Colour that signals the identity of this team.
             */
            teamColour: z.string(),

            /**
             * Name of the team that the volunteer could consider.
             */
            teamName: z.string(),

            /**
             * Unique slug of the team that can be selected by the volunteer.
             */
            teamSlug: z.string(),

            /**
             * Current status of the volunteer's participation in this team.
             */
            status: z.enum(['Unregistered', 'Registered', 'Cancelled', 'Accepted', 'Rejected' ]),

        })).optional(),
    }),
});

export type VolunteerTeamsDefinition = ApiDefinition<typeof kVolunteerTeamsDefinition>;

type Request = ApiRequest<typeof kVolunteerTeamsDefinition>;
type Response = ApiResponse<typeof kVolunteerTeamsDefinition>;

/**
 * API that allows to read and write the team that a particular volunteer (can) participate in.
 */
export async function volunteerTeams(request: Request, props: ActionProps): Promise<Response> {
    executeAccessCheck(props.authenticationContext, {
        check: 'admin-event',
        event: request.event,
        permission: {
            permission: 'event.volunteers.participation',
            scope: {
                event: request.event,
            },
        },
    });

    const event = await getEventBySlug(request.event);

    const usersEventsJoin = tUsersEvents.forUseInLeftJoin();

    const teamsAvailability = await db.selectFrom(tEvents)
        .innerJoin(tEventsTeams)
            .on(tEventsTeams.eventId.equals(tEvents.eventId))
                .and(tEventsTeams.enableTeam.equals(/* true= */ 1))
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tEventsTeams.teamId))
        .innerJoin(tTeamsRoles)
            .on(tTeamsRoles.teamId.equals(tTeams.teamId))
                .and(tTeamsRoles.roleDefault.equals(/* true= */ 1))
        .leftJoin(usersEventsJoin)
            .on(usersEventsJoin.eventId.equals(tEvents.eventId))
                .and(usersEventsJoin.teamId.equals(tEventsTeams.teamId))
                .and(usersEventsJoin.userId.equals(request.userId))
        .where(tEvents.eventSlug.equals(request.event))
        .select({
            teamId: tTeams.teamId,
            teamColour: tTeams.teamColourLightTheme,
            teamName: tTeams.teamName,
            teamSlug: tTeams.teamSlug,
            teamDefaultRole: tTeamsRoles.roleId,
            status: usersEventsJoin.registrationStatus,
        })
        .orderBy('teamName', 'asc')
        .executeSelectMany();

    if (!event || !teamsAvailability.length)
        notFound();

    // Case (1): Retrieve the team availability for this particular volunteer.
    if (!request.update) {
        const teams: Response['teams'] = teamsAvailability.map(team => ({
            teamId: team.teamId,
            teamColour: team.teamColour,
            teamName: team.teamName,
            teamSlug: team.teamSlug,
            status: team.status ?? 'Unregistered',
        }));

        return { success: true, teams };
    }

    // Case (2): Update the volunteer's assigned team.
    const { currentTeam, updatedTeam } = request.update;

    let verifiedCurrentTeam: typeof teamsAvailability[number] | undefined = undefined;
    let verifiedUpdatedTeam: typeof teamsAvailability[number] | undefined = undefined;

    for (const team of teamsAvailability) {
        if (team.teamSlug === currentTeam && !!team.status)
            verifiedCurrentTeam = team;
        else if (team.teamSlug === updatedTeam && !team.status)
            verifiedUpdatedTeam = team;
    }

    if (!verifiedCurrentTeam || !verifiedUpdatedTeam)
        return { success: false, error: 'Unable to verify the source and updated teams' };

    const affectedRows = await db.update(tUsersEvents)
        .set({
            teamId: verifiedUpdatedTeam.teamId,
            roleId: verifiedUpdatedTeam.teamDefaultRole,
            registrationStatus: kRegistrationStatus.Accepted,
        })
        .where(tUsersEvents.userId.equals(request.userId))
            .and(tUsersEvents.eventId.equals(event.eventId))
            .and(tUsersEvents.teamId.equals(verifiedCurrentTeam.teamId))
        .executeUpdate();

    const { subject, message } = request.update;
    if (!subject || !message || /* null check= */ !props.user) {
        if (!props.access.can('organisation.silent'))
            forbidden();

    } else {
        const username = await db.selectFrom(tUsers)
            .where(tUsers.userId.equals(request.userId))
            .selectOneColumn(tUsers.username)
            .executeSelectOne();

        if (!username)
            return { success: false, error: 'Unable to inform the user' };

        await SendEmailTask.Schedule({
            sender: `${props.user.firstName} ${props.user.lastName} (AnimeCon)`,
            message: {
                to: username,
                subject: subject,
                markdown: message,
            },
            attribution: {
                sourceUserId: props.user.id,
                targetUserId: request.userId,
            },
        });
    }

    if (affectedRows > 0) {
        RecordLog({
            type: kLogType.AdminEventTeamUpdate,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            targetUser: request.userId,
            data: {
                event: event.shortName,
                sourceTeam: verifiedCurrentTeam.teamName,
                targetTeam: verifiedUpdatedTeam.teamName,
                ip: props.ip
            }
        });
    }

    return { success: !!affectedRows };
}
