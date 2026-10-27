// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { DBConnection } from '@lib/database/Connection';
import { tHotels, tHotelsBookings, tHotelsPayments, tUsers } from '@lib/database';

/**
 * Parameters relaying context about a hotel room booking.
 */
export type HotelBookingContextParameters<FieldName extends string = 'hotel'> = {
    [K in FieldName]: {
        checkInDate: string;
        checkOutDate: string;

        secondOccupant?: string;
        thirdOccupant?: string;

        name: string;
        roomName: string;
        roomPrice: number;
    };
};

/**
 * Example parameters that convey information about the person's hotel room booking.
 */
export const kHotelBookingContextExampleParameters: HotelBookingContextParameters['hotel'] = {
    checkInDate: '2026-04-17',
    checkOutDate: '2026-04-19',

    secondOccupant: 'Theresa',
    thirdOccupant: 'Angela',

    name: 'Bastion Hotel Rijswijk',
    roomName: 'Deluxe Twin Room',
    roomPrice: 160,
};

/**
 * Queries the hotel booking context for the given `bookingId` and `recipientId`. Will throw an
 * exception when the booking does not exist or does not include the `recipientId`.
 */
export async function queryHotelBookingContext(
    db: DBConnection, bookingId: number, recipientId: number)
    : Promise<HotelBookingContextParameters['hotel']>
{
    const firstUserJoin = tUsers.forUseInLeftJoinAs('fu');
    const secondUserJoin = tUsers.forUseInLeftJoinAs('su');
    const thirdUserJoin = tUsers.forUseInLeftJoinAs('tu');

    const booking = await db.selectFrom(tHotelsBookings)
        .innerJoin(tHotels)
            .on(tHotels.hotelId.equals(tHotelsBookings.bookingHotelId))
                .and(tHotels.hotelRoomDeleted.isNull())
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(recipientId))
        .leftJoin(firstUserJoin)
            .on(firstUserJoin.userId.equals(tHotelsBookings.bookingFirstUserId))
        .leftJoin(secondUserJoin)
            .on(secondUserJoin.userId.equals(tHotelsBookings.bookingSecondUserId))
        .leftJoin(thirdUserJoin)
            .on(thirdUserJoin.userId.equals(tHotelsBookings.bookingThirdUserId))
        .where(tHotelsBookings.bookingId.equals(bookingId))
            .and(tHotelsBookings.bookingDeleted.isNull())
            .and(tHotelsBookings.bookingFirstUserId.equals(recipientId).or(
                tHotelsBookings.bookingSecondUserId.equals(recipientId)).or(
                tHotelsBookings.bookingThirdUserId.equals(recipientId)))
        .select({
            eventId: tHotelsBookings.eventId,
            recipientName: tUsers.name,

            checkInDate: db.dateAsString(tHotelsBookings.bookingCheckIn),
            checkOutDate: db.dateAsString(tHotelsBookings.bookingCheckOut),

            firstUserId: tHotelsBookings.bookingFirstUserId,
            firstName: tHotelsBookings.bookingFirstName.valueWhenNull(
                firstUserJoin.displayName.valueWhenNull(firstUserJoin.firstName)),

            secondUserId: tHotelsBookings.bookingSecondUserId,
            secondName: tHotelsBookings.bookingSecondName.valueWhenNull(
                secondUserJoin.displayName.valueWhenNull(secondUserJoin.firstName)),

            thirdUserId: tHotelsBookings.bookingThirdUserId,
            thirdName: tHotelsBookings.bookingThirdName.valueWhenNull(
                thirdUserJoin.displayName.valueWhenNull(thirdUserJoin.firstName)),

            name: tHotels.hotelName,
            roomName: tHotels.hotelRoomName,
            roomPrice: tHotels.hotelRoomPrice,
        })
        .executeSelectOne();

    const paymentAmount = await db.selectFrom(tHotelsPayments)
        .where(tHotelsPayments.eventId.equals(booking.eventId))
            .and(tHotelsPayments.paymentName.equals(booking.recipientName))
        .selectOneColumn(tHotelsPayments.paymentAmount)
        .executeSelectNoneOrOne();

    const otherOccupants: string[] = [];
    if (booking.firstUserId !== recipientId && !!booking.firstName)
        otherOccupants.push(booking.firstName);
    if (booking.secondUserId !== recipientId && !!booking.secondName)
        otherOccupants.push(booking.secondName);
    if (booking.thirdUserId !== recipientId && !!booking.thirdName)
        otherOccupants.push(booking.thirdName);

    return {
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,

        secondOccupant: otherOccupants[0],
        thirdOccupant: otherOccupants[1],

        name: booking.name,
        roomName: booking.roomName,
        roomPrice: Math.round((paymentAmount ?? booking.roomPrice) / 100),
    };
}
