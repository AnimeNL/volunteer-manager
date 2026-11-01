// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import type { ExtractRowModel } from '@app/admin/components/DataTable';
import { createDataSource, kEventTransformer, kTeamTransformer, withContext, withRowModel }
    from '@app/admin/components/DataTable';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { isBefore } from '@lib/Temporal';
import db, { tEvents, tHotelsBookings, tRefunds, tRoles, tSchedule, tShifts, tShiftsCategories,
    tTrainingsAssignments, tUsers, tUsersCommunication, tUsersEvents,
    tUsersEventsPreferencesAvailability, tUsersEventsPreferencesHotel,
    tUsersEventsPreferencesRefunds, tUsersEventsPreferencesTraining, tUsersEventsTickets,
    tYourTicketProviderPurchases } from '@lib/database';

import { kCommunicationLanguage, kEventAvailabilityStatus, kRegistrationStatus }
    from '@lib/database/Types';

/**
 * Processes volunteer communication records to extract the latest communication date per prompt.
 */
export function processVolunteerCommunication(
    records: { promptId?: string | null; date: Temporal.ZonedDateTime }[]): Record<string, string>
{
    const communication: Record<string, string> = {};
    const communicationPrompts = new Map<string, Temporal.ZonedDateTime>();
    for (const item of records) {
        if (!item.promptId)
            continue;

        const latestCommunication = communicationPrompts.get(item.promptId);
        if (!latestCommunication || isBefore(latestCommunication, item.date))
            communicationPrompts.set(item.promptId, item.date);
    }

    for (const [ promptId, date ] of communicationPrompts.entries())
        communication[promptId] = date.toString();

    return communication;
}

/**
 * Data source used to populate the volunteer list for a particular event and team tuple.
 */
export const volunteerDataSource = createDataSource('event/team/volunteers', withContext({
    /**
     * Unique ID of the event to display volunteers for.
     */
    event: kEventTransformer,

    /**
     * Unique ID of the team to display volunteers for.
     */
    team: kTeamTransformer,

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
        availabilityEligible: z.boolean(),
        availabilityPreferences: z.boolean(),

        hotelConfirmed: z.boolean(),
        hotelEligible: z.boolean(),
        hotelPreferences: z.number().optional(),

        refundConfirmed: z.boolean(),
        refundPreferences: z.boolean(),

        ticketEligible: z.boolean(),

        trainingConfirmed: z.boolean(),
        trainingEligible: z.boolean(),
        trainingPreferences: z.number().optional(),
    }),

    /**
     * Whether the user has been granted a valid ticket for this event.
     */
    ticket: z.boolean(),

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
            permission: 'volunteers.participation',
            operation: 'read',
            scope: {
                event: context.event.slug,
                team: context.team.slug,
            },
        });
    },

    async list(params, props, context) {
        const usersCommunicationJoin = tUsersCommunication.forUseInLeftJoin();

        const dbInstance = db;

        const priorEvent = tEvents.as('priorEvent');
        const priorRegistration = tUsersEvents.as('priorRegistration');

        const priorEventsSubSelect = dbInstance.subSelectUsing(tUsersEvents)
            .from(priorRegistration)
            .innerJoin(priorEvent)
                .on(priorEvent.eventId.equals(priorRegistration.eventId))
            .where(priorRegistration.userId.equals(tUsersEvents.userId))
                .and(priorEvent.eventStartTime.lessThan(context.event.startTime))
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

        const hotelsBookingsJoin = tHotelsBookings.forUseInLeftJoin();
        const preferencesAvailabilityJoin = tUsersEventsPreferencesAvailability.forUseInLeftJoin();
        const preferencesHotelJoin = tUsersEventsPreferencesHotel.forUseInLeftJoin();
        const preferencesRefundsJoin = tUsersEventsPreferencesRefunds.forUseInLeftJoin();
        const preferencesTrainingJoin = tUsersEventsPreferencesTraining.forUseInLeftJoin();
        const refundsJoin = tRefunds.forUseInLeftJoin();
        const trainingsAssignmentsJoin = tTrainingsAssignments.forUseInLeftJoin();
        const usersEventsTicketsJoin = tUsersEventsTickets.forUseInLeftJoin();
        const yourTicketProviderPurchasesJoin = tYourTicketProviderPurchases.forUseInLeftJoin();

        const purchaseIdCast = dbInstance.fragmentWithType('int', 'optional')
            .sql`CAST(${usersEventsTicketsJoin.ticketProviderPurchaseId} AS INTEGER)`;

        const volunteers = await dbInstance.selectFrom(tUsersEvents)
            .innerJoin(tEvents)
                .on(tEvents.eventId.equals(tUsersEvents.eventId))
            .innerJoin(tUsers)
                .on(tUsers.userId.equals(tUsersEvents.userId))
            .innerJoin(tRoles)
                .on(tRoles.roleId.equals(tUsersEvents.roleId))
            .leftJoin(preferencesAvailabilityJoin)
                .on(preferencesAvailabilityJoin.userId.equals(tUsersEvents.userId))
                    .and(preferencesAvailabilityJoin.eventId.equals(tUsersEvents.eventId))
                    .and(preferencesAvailabilityJoin.teamId.equals(tUsersEvents.teamId))
                    .and(preferencesAvailabilityJoin.preferenceVersionIsLatest.equals(
                        /* true= */ 1))
                    .and(tUsersEvents.registrationDate.isNull().or(
                        preferencesAvailabilityJoin.preferenceVersion.notEquals(
                            tUsersEvents.registrationDate as any)))
            .leftJoin(preferencesHotelJoin)
                .on(preferencesHotelJoin.userId.equals(tUsersEvents.userId))
                    .and(preferencesHotelJoin.eventId.equals(tUsersEvents.eventId))
                    .and(preferencesHotelJoin.preferenceVersionIsLatest.equals(/* true= */ 1))
            .leftJoin(hotelsBookingsJoin)
                .on(hotelsBookingsJoin.eventId.equals(tUsersEvents.eventId))
                    .and(hotelsBookingsJoin.bookingConfirmed.isNotNull())
                    .and(hotelsBookingsJoin.bookingDeleted.isNull())
                    .and(hotelsBookingsJoin.bookingFirstUserId.equals(tUsersEvents.userId).or(
                        hotelsBookingsJoin.bookingSecondUserId.equals(tUsersEvents.userId)).or(
                        hotelsBookingsJoin.bookingThirdUserId.equals(tUsersEvents.userId)))
            .leftJoin(preferencesRefundsJoin)
                .on(preferencesRefundsJoin.userId.equals(tUsersEvents.userId))
                    .and(preferencesRefundsJoin.eventId.equals(tUsersEvents.eventId))
                    .and(preferencesRefundsJoin.preferenceVersionIsLatest.equals(/* true= */ 1))
            .leftJoin(refundsJoin)
                .on(refundsJoin.userId.equals(tUsersEvents.userId))
                    .and(refundsJoin.eventId.equals(tUsersEvents.eventId))
            .leftJoin(preferencesTrainingJoin)
                .on(preferencesTrainingJoin.userId.equals(tUsersEvents.userId))
                    .and(preferencesTrainingJoin.eventId.equals(tUsersEvents.eventId))
                    .and(preferencesTrainingJoin.preferenceVersionIsLatest.equals(/* true= */ 1))
            .leftJoin(trainingsAssignmentsJoin)
                .on(trainingsAssignmentsJoin.eventId.equals(tUsersEvents.eventId))
                    .and(trainingsAssignmentsJoin.assignmentUserId.equals(tUsersEvents.userId))
            .leftJoin(usersCommunicationJoin)
                .on(usersCommunicationJoin.userId.equals(tUsersEvents.userId))
                    .and(usersCommunicationJoin.communicationEventId.equals(tUsersEvents.eventId))
                    .and(usersCommunicationJoin.communicationTeamId.equals(tUsersEvents.teamId))
                    .and(usersCommunicationJoin.communicationPromptId.isNotNull())
            .leftJoin(usersEventsTicketsJoin)
                .on(usersEventsTicketsJoin.userId.equals(tUsersEvents.userId))
                    .and(usersEventsTicketsJoin.eventId.equals(tUsersEvents.eventId))
            .leftJoin(yourTicketProviderPurchasesJoin)
                .on(usersEventsTicketsJoin.ticketProvider.equals('YourTicketProvider'))
                    .and(yourTicketProviderPurchasesJoin.ytpPurchaseId.equals(purchaseIdCast))
                    .and(yourTicketProviderPurchasesJoin.ytpPurchaseDateCancelled.isNull())
            .groupBy(tUsersEvents.userId)
            .where(tUsersEvents.eventId.equals(context.event.id))
                .and(tUsersEvents.teamId.equals(context.team.id))
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
                    availabilityEligible:
                        tEvents.eventAvailabilityStatus.notEquals(
                            kEventAvailabilityStatus.Unavailable),
                    availabilityPreferences:
                        preferencesAvailabilityJoin.preferenceVersion.isNotNull(),

                    hotelConfirmed:
                        tEvents.hotelEnabled.equals(/* true= */ 1).and(
                            hotelsBookingsJoin.bookingConfirmed.isNotNull()),
                    hotelEligible:
                        tEvents.hotelEnabled.equals(/* true= */ 1).and(
                            tUsersEvents.hotelEligible.valueWhenNull(
                                tRoles.roleHotelEligible).equals(/* true= */ 1)),
                    hotelPreferences: preferencesHotelJoin.hotelInterested,

                    refundConfirmed:
                        tEvents.refundEnabled.equals(/* true= */ 1).and(
                            refundsJoin.refundConfirmed.isNotNull()),
                    refundPreferences:
                        tEvents.refundEnabled.equals(/* true= */ 1).and(
                            preferencesRefundsJoin.preferenceVersion.isNotNull()),

                    ticketEligible: tEvents.ticketsAutoGrantTicketId.isNotNull(),

                    trainingConfirmed:
                        tEvents.trainingEnabled.equals(/* true= */ 1).and(
                            trainingsAssignmentsJoin.assignmentConfirmed.equals(
                                /* true= */ 1).valueWhenNull(/* false= */ false)),
                    trainingEligible:
                        tEvents.trainingEnabled.equals(/* true= */ 1).and(
                            tUsersEvents.trainingEligible.valueWhenNull(
                                tRoles.roleTrainingEligible).equals(/* true= */ 1)),
                    trainingPreferences: preferencesTrainingJoin.trainingId,
                },
                ticket: yourTicketProviderPurchasesJoin.ytpPurchaseItemId.isNotNull(),
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

        const rows = volunteers.data.map(volunteer => ({
            ...volunteer,
            communication: processVolunteerCommunication(volunteer.communication),
        }));

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
