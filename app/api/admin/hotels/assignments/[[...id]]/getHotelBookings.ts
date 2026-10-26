// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import db, { tHotelsBookings, tTeams, tUsers, tUsersEvents } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Row model for a hotel booking and its assigned occupants.
 */
export interface HotelsAssignmentsRowModel {
    id: number;
    firstName?: string;
    firstUserId?: number;
    firstTeam?: string;
    secondName?: string;
    secondUserId?: number;
    secondTeam?: string;
    thirdName?: string;
    thirdUserId?: number;
    thirdTeam?: string;
    hotelId?: number;
    checkIn: string;
    checkOut: string;
    confirmed: boolean;
}

/**
 * Retrieves the hotel bookings for the given `eventId` in line with the row model of hotel
 * assignments. This combines data from various database tables. Optionally the `bookingId` can be
 * specified to limit results to a single booking.
 */
export async function getHotelBookings(eventId: number, bookingId?: number)
    : Promise<HotelsAssignmentsRowModel[]>
{
    const firstTeamJoin = tTeams.forUseInLeftJoinAs('ft');
    const firstUserEventJoin = tUsersEvents.forUseInLeftJoinAs('fue');
    const firstUserJoin = tUsers.forUseInLeftJoinAs('fu');

    const secondTeamJoin = tTeams.forUseInLeftJoinAs('st');
    const secondUserEventJoin = tUsersEvents.forUseInLeftJoinAs('sue');
    const secondUserJoin = tUsers.forUseInLeftJoinAs('su');

    const thirdTeamJoin = tTeams.forUseInLeftJoinAs('tt');
    const thirdUserEventJoin = tUsersEvents.forUseInLeftJoinAs('tue');
    const thirdUserJoin = tUsers.forUseInLeftJoinAs('tu');

    const dbInstance = db;
    return await dbInstance.selectFrom(tHotelsBookings)
        .leftJoin(firstUserJoin)
            .on(firstUserJoin.userId.equals(tHotelsBookings.bookingFirstUserId))
        .leftJoin(firstUserEventJoin)
            .on(firstUserEventJoin.eventId.equals(tHotelsBookings.eventId))
                .and(firstUserEventJoin.userId.equals(tHotelsBookings.bookingFirstUserId))
                .and(firstUserEventJoin.registrationStatus.in(
                    [ kRegistrationStatus.Accepted, kRegistrationStatus.Cancelled ]))
        .leftJoin(firstTeamJoin)
            .on(firstTeamJoin.teamId.equals(firstUserEventJoin.teamId))
        .leftJoin(secondUserJoin)
            .on(secondUserJoin.userId.equals(tHotelsBookings.bookingSecondUserId))
        .leftJoin(secondUserEventJoin)
            .on(secondUserEventJoin.eventId.equals(tHotelsBookings.eventId))
                .and(secondUserEventJoin.userId.equals(tHotelsBookings.bookingSecondUserId))
                .and(secondUserEventJoin.registrationStatus.in(
                    [ kRegistrationStatus.Accepted, kRegistrationStatus.Cancelled ]))
        .leftJoin(secondTeamJoin)
            .on(secondTeamJoin.teamId.equals(secondUserEventJoin.teamId))
        .leftJoin(thirdUserJoin)
            .on(thirdUserJoin.userId.equals(tHotelsBookings.bookingThirdUserId))
        .leftJoin(thirdUserEventJoin)
            .on(thirdUserEventJoin.eventId.equals(tHotelsBookings.eventId))
                .and(thirdUserEventJoin.userId.equals(tHotelsBookings.bookingThirdUserId))
                .and(thirdUserEventJoin.registrationStatus.in(
                    [ kRegistrationStatus.Accepted, kRegistrationStatus.Cancelled ]))
        .leftJoin(thirdTeamJoin)
            .on(thirdTeamJoin.teamId.equals(thirdUserEventJoin.teamId))
        .where(tHotelsBookings.eventId.equals(eventId))
            .and(tHotelsBookings.bookingId.equalsIfValue(bookingId))
            .and(tHotelsBookings.bookingDeleted.isNull())
        .select({
            id: tHotelsBookings.bookingId,

            firstName: tHotelsBookings.bookingFirstName.valueWhenNull(firstUserJoin.name),
            firstUserId: tHotelsBookings.bookingFirstUserId,
            firstTeam: firstTeamJoin.teamSlug,

            secondName: tHotelsBookings.bookingSecondName.valueWhenNull(secondUserJoin.name),
            secondUserId: tHotelsBookings.bookingSecondUserId,
            secondTeam: secondTeamJoin.teamSlug,

            thirdName: tHotelsBookings.bookingThirdName.valueWhenNull(thirdUserJoin.name),
            thirdUserId: tHotelsBookings.bookingThirdUserId,
            thirdTeam: thirdTeamJoin.teamSlug,

            hotelId: tHotelsBookings.bookingHotelId,
            checkIn: dbInstance.dateAsString(tHotelsBookings.bookingCheckIn),
            checkOut: dbInstance.dateAsString(tHotelsBookings.bookingCheckOut),
            confirmed: tHotelsBookings.bookingConfirmed.isNotNull(),
        })
        .orderBy('confirmed', 'desc')
            .orderBy('checkIn', 'asc')
            .orderBy('checkOut', 'asc')
            .orderBy('id', 'asc')
        .executeSelectMany();
}
