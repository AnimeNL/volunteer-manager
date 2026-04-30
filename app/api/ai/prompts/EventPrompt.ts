// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { PromptContext, PromptParams } from './Prompt';
import type { Temporal } from '@lib/Temporal';
import { Prompt } from './Prompt';
import { tEvents, tRoles, tTeams, tUsersEvents, tUsers } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Context that has been collected by the prompt structure.
 */
export interface EventPromptContext extends PromptContext {
    /**
     * Context about the event with which the prompt is associated.
     */
    event: {
        id: number;
        name: string;
        shortName: string;
        slug: string;

        location?: string;

        startTime: Temporal.ZonedDateTime;
        endTime: Temporal.ZonedDateTime;

        eventTimingPublished: boolean;
    };

    /**
     * Context about the source user on whose behalf the prompt will be executed.
     */
    sourceUser: {
        name: string;
        firstName: string;
        role?: string;
        team?: string;
    };

    /**
     * Context about the target user to whom the generated message will be sent.
     */
    targetUser: {
        name: string;
        firstName: string;
        role?: string;
        team?: string;

        hotelEligible?: boolean;
        trainingEligible?: boolean;
    };
}

/**
 * Parameters that are expected to be available for the prompt.
 */
export interface EventPromptParams extends PromptParams {
    /**
     * URL-safe slug representing the event with which this prompt is associated.
     */
    event: string;

    /**
     * Unique ID of the source user on whose behalf the prompt will be executed.
     */
    sourceUserId: number;

    /**
     * Unique ID of the target user to whom the generated message will be sent.
     */
    targetUserId: number;

    /**
     * URL-safe slug representing the team with which this prompt is associated.
     */
    team?: string;
}

/**
 * The `EventPrompt` class represents a prompt that is associated with a particular event and
 * therein participating volunteer. It includes knowledge about both in the context.
 */
export abstract class EventPrompt<Context extends EventPromptContext,
                                  Params extends EventPromptParams>
    extends Prompt<Context, Params>
{
    /**
     * Collects information about the event and the volunteer and makes it available to the context,
     * based on which the message will be composed.
     */
    override async collectContext(params: Params): Promise<EventPromptContext> {
        const base = await super.collectContext(params);

        const event = await this.db.selectFrom(tEvents)
            .where(tEvents.eventSlug.equals(params.event))
            .select({
                id: tEvents.eventId,
                name: tEvents.eventName,
                shortName: tEvents.eventShortName,
                slug: tEvents.eventSlug,

                location: tEvents.eventLocation,

                startTime: tEvents.eventStartTime,
                endTime: tEvents.eventEndTime,

                eventTimingPublished: tEvents.eventTimingPublished.equals(/* true= */ 1),
            })
            .executeSelectOne();

        let teamId: number | undefined;
        if (!!params.team) {
            teamId = await this.db.selectFrom(tTeams)
                .selectOneColumn(tTeams.teamId)
                .where(tTeams.teamSlug.equals(params.team))
                .executeSelectNoneOrOne() || undefined;
        }

        const rolesJoin = tRoles.forUseInLeftJoin();
        const teamsJoin = tTeams.forUseInLeftJoin();
        const usersEventsJoin = tUsersEvents.forUseInLeftJoin();

        const sourceUser = await this.db.selectFrom(tUsers)
            .innerJoin(tEvents)
                .on(tEvents.eventSlug.equals(params.event))
            .leftJoin(usersEventsJoin)
                .on(usersEventsJoin.userId.equals(tUsers.userId))
                    .and(usersEventsJoin.eventId.equals(tEvents.eventId))
                    .and(usersEventsJoin.registrationStatus.equals(kRegistrationStatus.Accepted))
            .leftJoin(rolesJoin)
                .on(rolesJoin.roleId.equals(usersEventsJoin.roleId))
            .leftJoin(teamsJoin)
                .on(teamsJoin.teamId.equals(usersEventsJoin.teamId))
            .select({
                name: tUsers.name,
                firstName: tUsers.firstName,
                role: rolesJoin.roleName,
                team: teamsJoin.teamTitle,
            })
            .where(tUsers.userId.equals(params.sourceUserId))
            .executeSelectOne();

        const targetUser = await this.db.selectFrom(tUsers)
            .innerJoin(tEvents)
                .on(tEvents.eventSlug.equals(params.event))
            .leftJoin(usersEventsJoin)
                .on(usersEventsJoin.userId.equals(tUsers.userId))
                    .and(usersEventsJoin.eventId.equals(tEvents.eventId))
                    .and(usersEventsJoin.teamId.equalsIfValue(teamId))
            .leftJoin(rolesJoin)
                .on(rolesJoin.roleId.equals(usersEventsJoin.roleId))
            .leftJoin(teamsJoin)
                .on(teamsJoin.teamId.equals(usersEventsJoin.teamId))
            .select({
                name: tUsers.name,
                firstName: tUsers.firstName,
                role: rolesJoin.roleName,
                team: teamsJoin.teamTitle,

                hotelEligible: rolesJoin.roleHotelEligible.equals(/* true= */ 1),
                trainingEligible: rolesJoin.roleTrainingEligible.equals(/* true= */ 1),
            })
            .where(tUsers.userId.equals(params.targetUserId))
            .executeSelectOne();

        return {
            ...base,
            event,
            sourceUser,
            targetUser,
        };
    }

    /**
     * Include the e-mail's addressee and signaturee in the composed message. This avoids having to
     * repeat it for each message that the Volunteer Manager is able to generate.
     */
    override composeMessage(context: Context): string[] {
        const message = super.composeMessage(context);
        message.push(`Address the e-mail to ${context.targetUser.firstName}, say hi`);

        if (context.sourceUser.team) {
            message.push(
                `Finish the e-mail by saying thank you, signed by ${context.sourceUser.name}, of ` +
                `the AnimeCon ${context.sourceUser.team}`);

        } else {
            message.push(
                `Sign the e-mail from ${context.sourceUser.name}, of the AnimeCon Volunteering ` +
                'Teams');
        }

        return message;
    }
}
