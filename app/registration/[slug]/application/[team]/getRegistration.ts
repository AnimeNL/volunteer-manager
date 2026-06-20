// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import db, { tEvents, tEventsTeams, tHotels, tHotelsAssignments, tHotelsBookings,
    tHotelsPreferences, tRefunds, tRoles, tTeams, tTrainings, tTrainingsAssignments, tUsers,
    tUsersEvents } from '@lib/database';

/**
 * Retrieves the registration associated with the given `userId` at the given `event`. When no such
 * registration exists, `undefined` will be returned instead.
 */
export async function getRegistration(eventId: number, teamId: number, userId: number) {
    const hotelsJoin = tHotels.forUseInLeftJoin();
    const hotelsPreferencesJoin = tHotelsPreferences.forUseInLeftJoin();
    const refundsJoin = tRefunds.forUseInLeftJoin();
    const trainingsAssignedJoin = tTrainings.forUseInLeftJoinAs('t1');
    const trainingsPreferenceJoin = tTrainings.forUseInLeftJoinAs('t2');
    const trainingsAssignmentsJoin = tTrainingsAssignments.forUseInLeftJoin();

    const dbInstance = db;
    const registration = await dbInstance.selectFrom(tUsersEvents)
        .innerJoin(tEvents)
            .on(tEvents.eventId.equals(tUsersEvents.eventId))
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tUsersEvents.teamId))
        .innerJoin(tEventsTeams)
            .on(tEventsTeams.eventId.equals(tUsersEvents.eventId))
            .and(tEventsTeams.teamId.equals(tUsersEvents.teamId))
        .innerJoin(tRoles)
            .on(tRoles.roleId.equals(tUsersEvents.roleId))
        .leftJoin(hotelsPreferencesJoin)
            .on(hotelsPreferencesJoin.userId.equals(tUsersEvents.userId))
                .and(hotelsPreferencesJoin.eventId.equals(tUsersEvents.eventId))
                .and(hotelsPreferencesJoin.teamId.equals(tUsersEvents.teamId))
        .leftJoin(hotelsJoin)
            .on(hotelsJoin.hotelId.equals(hotelsPreferencesJoin.hotelId))
        .leftJoin(refundsJoin)
            .on(refundsJoin.userId.equals(tUsersEvents.userId))
                .and(refundsJoin.eventId.equals(tUsersEvents.eventId))
        .leftJoin(trainingsAssignmentsJoin)
            .on(trainingsAssignmentsJoin.assignmentUserId.equals(tUsersEvents.userId))
            .and(trainingsAssignmentsJoin.eventId.equals(tUsersEvents.eventId))
        .leftJoin(trainingsPreferenceJoin)
            .on(trainingsPreferenceJoin.trainingId.equals(
                trainingsAssignmentsJoin.preferenceTrainingId))
        .leftJoin(trainingsAssignedJoin)
            .on(trainingsAssignedJoin.trainingId.equals(
                trainingsAssignmentsJoin.assignmentTrainingId))
        .where(tUsersEvents.userId.equals(userId))
            .and(tUsersEvents.eventId.equals(eventId))
            .and(tUsersEvents.teamId.equals(teamId))
        .select({
            role: tRoles.roleName,
            teamId: tTeams.teamId,
            status: tUsersEvents.registrationStatus,

            availabilityStatus: tEvents.eventAvailabilityStatus,
            availabilityEventLimit: tUsersEvents.availabilityEventLimit.valueWhenNull(
                tRoles.roleAvailabilityEventLimit),
            availability: {
                preferences: tUsersEvents.preferences,
                preferencesDietary: tUsersEvents.preferencesDietary,
                timeslots: tUsersEvents.availabilityTimeslots,
                serviceHours: tUsersEvents.preferenceHours,
                serviceTimingStart: tUsersEvents.preferenceTimingStart,
                serviceTimingEnd: tUsersEvents.preferenceTimingEnd,
            },

            hotelInformationPublished: tEvents.hotelInformationPublished.equals(/* true= */ 1),
            hotelAvailabilityWindow: {
                start: tEvents.hotelPreferencesStart,
                end: tEvents.hotelPreferencesEnd,
            },
            hotelEligible: tUsersEvents.hotelEligible.valueWhenNull(
                tRoles.roleHotelEligible).equals(/* true= */ 1),
            hotelPreferences: {
                hotelId: hotelsPreferencesJoin.hotelId,
                hotelName: hotelsJoin.hotelName,
                hotelRoom: hotelsJoin.hotelRoomName,
                checkIn: dbInstance.dateAsString(hotelsPreferencesJoin.hotelDateCheckIn),
                checkOut: dbInstance.dateAsString(hotelsPreferencesJoin.hotelDateCheckOut),
                sharingPeople: hotelsPreferencesJoin.hotelSharingPeople,
                sharingPreferences: hotelsPreferencesJoin.hotelSharingPreferences,
                updated: dbInstance.dateTimeAsString(hotelsPreferencesJoin.hotelPreferencesUpdated),
            },

            refundInformationPublished: tEvents.refundInformationPublished.equals(/* true= */ 1),
            refundAvailabilityWindow: {
                start: tEvents.refundRequestsStart,
                end: tEvents.refundRequestsEnd,
            },
            refund: {
                ticketNumber: refundsJoin.refundTicketNumber,
                accountIban: refundsJoin.refundAccountIban,
                accountName: refundsJoin.refundAccountName,
                requested: dbInstance.dateTimeAsString(refundsJoin.refundRequested),
                confirmed: dbInstance.dateTimeAsString(refundsJoin.refundConfirmed),
            },

            trainingInformationPublished:
                tEvents.trainingInformationPublished.equals(/* true= */ 1),
            trainingAvailabilityWindow: {
                start: tEvents.trainingPreferencesStart,
                end: tEvents.trainingPreferencesEnd,
            },
            trainingEligible: tUsersEvents.trainingEligible.valueWhenNull(
                tRoles.roleTrainingEligible).equals(/* true= */ 1),
            training: {
                confirmed: trainingsAssignmentsJoin.assignmentConfirmed.equals(/* true= */ 1),
                preference: trainingsAssignmentsJoin.preferenceTrainingId,
                updated: dbInstance.dateTimeAsString(trainingsAssignmentsJoin.preferenceUpdated),

                preferenceDate: dbInstance.dateTimeAsString(trainingsPreferenceJoin.trainingStart),
                assignedDate: dbInstance.dateTimeAsString(trainingsAssignedJoin.trainingStart),
                assignedEndDate: dbInstance.dateTimeAsString(trainingsAssignedJoin.trainingEnd),
                assignedAddress: trainingsAssignedJoin.trainingAddress,
            },
        })
        .groupBy(tUsersEvents.eventId)
        .executeSelectNoneOrOne();

    const hotelsAssignmentsJoin = tHotelsAssignments.forUseInLeftJoinAs('a2');
    const usersJoin = tUsers.forUseInLeftJoin();

    const hotelBookings = await dbInstance.selectFrom(tHotelsAssignments)
        .innerJoin(tHotelsBookings)
            .on(tHotelsBookings.bookingId.equals(tHotelsAssignments.bookingId))
            .and(tHotelsBookings.bookingVisible.equals(/* true= */ 1))
        .innerJoin(tHotels)
            .on(tHotels.hotelId.equals(tHotelsBookings.bookingHotelId))
        .leftJoin(hotelsAssignmentsJoin)
            .on(hotelsAssignmentsJoin.bookingId.equals(tHotelsAssignments.bookingId))
            .and(hotelsAssignmentsJoin.assignmentUserId.notEquals(userId))
        .leftJoin(usersJoin)
            .on(usersJoin.userId.equals(hotelsAssignmentsJoin.assignmentUserId))
        .where(tHotelsAssignments.assignmentUserId.equals(userId))
            .and(tHotelsAssignments.eventId.equals(eventId))
            .and(tHotelsBookings.bookingConfirmed.equals(/* true= */ 1))
        .select({
            checkIn: dbInstance.dateAsString(tHotelsBookings.bookingCheckIn),
            checkOut: dbInstance.dateAsString(tHotelsBookings.bookingCheckOut),

            hotel: {
                name: tHotels.hotelName,
                room: tHotels.hotelRoomName,
            },

            sharing: dbInstance.aggregateAsArrayOfOneColumn(
                hotelsAssignmentsJoin.assignmentName.valueWhenNull(usersJoin.name)),
        })
        .groupBy(tHotelsAssignments.bookingId)
        .orderBy('checkIn', 'asc')
        .executeSelectMany();

    if (!registration)
        return undefined;

    return { registration, hotelBookings };
}

/**
 * Information about an existing registration.
 */
export type Registration = NonNullable<Awaited<ReturnType<typeof getRegistration>>>;
