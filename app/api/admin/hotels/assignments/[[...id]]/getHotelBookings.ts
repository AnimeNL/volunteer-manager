// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

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
import db, { tHotelsAssignments, tHotelsBookings, tHotels, tTeams, tUsersEvents, tUsers } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Retrieves the hotel bookings for the given `eventId` in line with the row model of hotel
 * assignments. This combines data from various database tables. Optionally the `bookingId` can be
 * specified to limit results to a single booking.
 */
export async function getHotelBookings(eventId: number, bookingId?: number)
    : Promise<HotelsAssignmentsRowModel[]>
{
    const teamsJoin = tTeams.forUseInLeftJoin();
    const usersEventsJoin = tUsersEvents.forUseInLeftJoin();
    const usersJoin = tUsers.forUseInLeftJoin();

    const assignments = await db.selectFrom(tHotelsAssignments)
        .innerJoin(tHotelsBookings)
            .on(tHotelsBookings.bookingId.equals(tHotelsAssignments.bookingId))
            .and(tHotelsBookings.bookingVisible.equals(/* true= */ 1))
        .leftJoin(usersJoin)
            .on(usersJoin.userId.equals(tHotelsAssignments.assignmentUserId))
        .leftJoin(usersEventsJoin)
            .on(usersEventsJoin.eventId.equals(tHotelsAssignments.eventId))
            .and(usersEventsJoin.userId.equals(tHotelsAssignments.assignmentUserId))
            .and(usersEventsJoin.registrationStatus.in(
                [ kRegistrationStatus.Accepted, kRegistrationStatus.Cancelled ]))
        .leftJoin(teamsJoin)
            .on(teamsJoin.teamId.equals(usersEventsJoin.teamId))
        .where(tHotelsAssignments.eventId.equals(eventId))
            .and(tHotelsAssignments.bookingId.equalsIfValue(bookingId))
        .select({
            bookingId: tHotelsAssignments.bookingId,
            name: tHotelsAssignments.assignmentName.valueWhenNull(
                usersJoin.name),

            userId: tHotelsAssignments.assignmentUserId,
            team: teamsJoin.teamSlug,
        })
        .orderBy(tHotelsAssignments.assignmentPrimary, 'desc')
            .orderBy('name', 'asc')
        .executeSelectMany();

    const assignmentsByBookingId = new Map<number, typeof assignments[number][]>();
    for (const assignment of assignments) {
        if (!assignmentsByBookingId.has(assignment.bookingId))
            assignmentsByBookingId.set(assignment.bookingId, [ assignment ]);
        else
            assignmentsByBookingId.get(assignment.bookingId)!.push(assignment);
    }

    const hotelsJoin = tHotels.forUseInLeftJoin();

    const dbInstance = db;
    const bookings = await dbInstance.selectFrom(tHotelsBookings)
        .leftJoin(hotelsJoin)
            .on(hotelsJoin.hotelId.equals(tHotelsBookings.bookingHotelId))
        .where(tHotelsBookings.eventId.equals(eventId))
            .and(tHotelsBookings.bookingId.equalsIfValue(bookingId))
            .and(tHotelsBookings.bookingVisible.equals(/* true= */ 1))
        .select({
            id: tHotelsBookings.bookingId,

            hotelId: tHotelsBookings.bookingHotelId,
            hotelName: hotelsJoin.hotelName,
            hotelRoomName: hotelsJoin.hotelRoomName,
            hotelVisible: hotelsJoin.hotelRoomVisible,

            checkIn: dbInstance.dateAsString(tHotelsBookings.bookingCheckIn),
            checkOut: dbInstance.dateAsString(tHotelsBookings.bookingCheckOut),
            confirmed: tHotelsBookings.bookingConfirmed,
        })
        .orderBy('confirmed', 'desc')
            .orderBy('checkIn', 'asc')
            .orderBy('checkOut', 'asc')
            .orderBy('id', 'asc')
        .executeSelectMany();

    return bookings.map(booking => {
        const assignments = assignmentsByBookingId.get(booking.id) ?? [];
        return {
            id: booking.id,
            firstName: assignments[0]?.name,
            firstUserId: assignments[0]?.userId,
            firstTeam: assignments[0]?.team,
            secondName: assignments[1]?.name,
            secondUserId: assignments[1]?.userId,
            secondTeam: assignments[1]?.team,
            thirdName: assignments[2]?.name,
            thirdUserId: assignments[2]?.userId,
            thirdTeam: assignments[2]?.team,
            hotelId: booking.hotelId,
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
            confirmed: !!booking.confirmed,
        };
    });
}
