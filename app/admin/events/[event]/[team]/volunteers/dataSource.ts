// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod';

import type { ExtractRowModel } from '@app/admin/components/DataTable';
import { createDataSource, withContext, withRowModel } from '@app/admin/components/DataTable';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { isBefore, type ZonedDateTime } from '@lib/Temporal';
import db, { tRoles, tUsersEvents, tUsers, tUsersCommunication, tSchedule, tShifts,
    tShiftsCategories, tEvents } from '@lib/database';

import { kAnyEvent, kAnyTeam } from '@lib/auth/AccessList';
import { kCommunicationLanguage, kRegistrationStatus } from '@lib/database/Types';

/**
 * Data source used to populate the volunteer list for a particular event and team tuple.
 */
export const volunteerDataSource = createDataSource('event/team/volunteers', withContext({
    /**
     * Unique ID of the event to display volunteers for.
     */
    eventId: z.number(),

    /**
     * Unique ID of the team to display volunteers for.
     */
    teamId: z.number(),

}), withRowModel({
    /**
     * Unique ID of the volunteer, as they exist in the database.
     */
    id: z.number(),

    /**
     * Name of the volunteer, preferring their display name over their actual one.
     */
    name: z.string(),

    /**
     * First name of the volunteer, unless they have a display name set.
     */
    firstName: z.string(),

    /**
     * When known, the language in which the volunteer would like to be communicated with in.
     */
    language: z.enum(kCommunicationLanguage).optional(),

    /**
     * Role the volunteer has been assigned in this event.
     */
    role: z.string(),

    /**
     * Order in which the row should be displayed. Used for the default sorting order.
     */
    roleOrder: z.number(),

    /**
     * Whether the role comes with a permission grant, which we presume means Senior+.
     */
    roleHasPermissionGrant: z.boolean(),

    /**
     * Total number of seconds a volunteer has been scheduled on shifts whose contribution should
     * count.
     */
    shiftSeconds: z.number().optional(),

    /**
     * Status of their application across the different types of information they have to provide.
     */
    status: z.object({
        hotelEligible: z.number(),
        trainingEligible: z.number(),
    }),

    /**
     * Most recent time a communication of a given type was sent, in a Temporal ZonedDateTime
     * compatible serialization.
     */
    communication: z.record(z.string(), z.string()),

    /**
     * Number of unique events the volunteer has participated in prior to the current event.
     */
    priorParticipationCount: z.number(),

}), {
    async authorize(operation, props, context) {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin',
            permission: {
                permission: 'event.volunteers.information',
                operation: 'read',
                scope: {
                    event: kAnyEvent,
                    team: kAnyTeam,
                },
            },
        });
    },

    async list(params, props, context) {
        const dbInstance = db;
        const usersCommunicationJoin = tUsersCommunication.forUseInLeftJoin();

        const currentEventStartTime = await dbInstance.selectFrom(tEvents)
            .where(tEvents.eventId.equals(context.eventId))
            .selectOneColumn(tEvents.eventStartTime)
            .executeSelectOne();

        const priorEvent = tEvents.as('priorEvent');
        const priorRegistration = tUsersEvents.as('priorRegistration');

        const priorEventsSubSelect = dbInstance.subSelectUsing(tUsersEvents)
            .from(priorRegistration)
            .innerJoin(priorEvent)
                .on(priorEvent.eventId.equals(priorRegistration.eventId))
            .where(priorRegistration.userId.equals(tUsersEvents.userId))
                .and(priorEvent.eventStartTime.lessThan(currentEventStartTime))
                .and(priorRegistration.registrationStatus.equals(kRegistrationStatus.Accepted))
            .selectOneColumn(dbInstance.count(priorRegistration.eventId))
            .forUseAsInlineQueryValue();

        const shiftSecondsFragment = dbInstance.fragmentWithType('int', 'optional').sql`
            TIMESTAMPDIFF(SECOND, ${tSchedule.scheduleTimeStart}, ${tSchedule.scheduleTimeEnd})`;

        const shiftSecondsSubSelect = dbInstance.subSelectUsing(tUsersEvents)
            .from(tSchedule)
            .innerJoin(tShifts)
                .on(tShifts.shiftId.equals(tSchedule.shiftId))
            .innerJoin(tShiftsCategories)
                .on(tShiftsCategories.shiftCategoryId.equals(tShifts.shiftCategoryId))
            .where(tSchedule.userId.equals(tUsersEvents.userId))
                .and(tSchedule.eventId.equals(tUsersEvents.eventId))
                .and(tSchedule.scheduleDeleted.isNull())
                .and(tShiftsCategories.shiftCategoryCountContribution.equals(/* true= */ 1))
            .selectOneColumn(dbInstance.sum(shiftSecondsFragment).valueWhenNull(0))
            .forUseAsInlineQueryValue();

        const volunteers = await dbInstance.selectFrom(tUsersEvents)
            .innerJoin(tUsers)
                .on(tUsers.userId.equals(tUsersEvents.userId))
            .innerJoin(tRoles)
                .on(tRoles.roleId.equals(tUsersEvents.roleId))
            .leftJoin(usersCommunicationJoin)
                .on(usersCommunicationJoin.userId.equals(tUsersEvents.userId))
                    .and(usersCommunicationJoin.communicationEventId.equals(tUsersEvents.eventId))
                    .and(usersCommunicationJoin.communicationTeamId.equals(tUsersEvents.teamId))
            .groupBy(tUsersEvents.userId)
            .where(tUsersEvents.eventId.equals(context.eventId))
                .and(tUsersEvents.teamId.equals(context.teamId))
                .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
                .and(tUsers.name.containsInsensitiveIfValue(params.search).or(
                    tRoles.roleName.containsInsensitiveIfValue(params.search)))
            .select({
                id: tUsers.userId,
                name: tUsers.name,
                firstName: tUsers.displayName.valueWhenNull(tUsers.firstName),
                language: tUsers.language,
                role: tRoles.roleName,
                roleOrder: tRoles.roleOrder,
                roleHasPermissionGrant: tRoles.rolePermissionGrant.isNotNull(),
                priorParticipationCount: priorEventsSubSelect.valueWhenNull(0),
                shiftSeconds: shiftSecondsSubSelect,
                status: {
                    hotelEligible:
                        tUsersEvents.hotelEligible.valueWhenNull(tRoles.roleHotelEligible),
                    trainingEligible:
                        tUsersEvents.trainingEligible.valueWhenNull(tRoles.roleTrainingEligible),
                },
                communication: dbInstance.aggregateAsArray({
                    promptId: usersCommunicationJoin.communicationPromptId,
                    date: usersCommunicationJoin.communicationDate,
                }),
            })
            .orderBy(params.sort.field as any, params.sort.direction)
                .orderBy('name', params.sort.direction)
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        const rows = volunteers.data.map(volunteer => {
            const communication: Record<string, string> = {};
            const communicationPrompts: Map<string, ZonedDateTime> = new Map();
            for (const item of volunteer.communication) {
                const latestCommunication = communicationPrompts.get(item.promptId);
                if (!latestCommunication || isBefore(latestCommunication, item.date))
                    communicationPrompts.set(item.promptId, item.date);
            }

            for (const [ promptId, date ] of communicationPrompts.entries())
                communication[promptId] = date.toString();

            return {
                ...volunteer,
                communication,
            };
        });

        return {
            rowCount: volunteers.count,
            rows,
        };
    },

});

/**
 * Export the row model for use in the child components used by the data table.
 */
export type VolunteerRowModel = ExtractRowModel<typeof volunteerDataSource>;
