// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';
import { cache } from 'react';

import type { CachedEvent } from '@lib/cache';
import db, { tHotels, tHotelsBookings, tUsers } from '@lib/database';

/**
 * Confirmed hotel room booking details for a volunteer participating in an event.
 */
interface VolunteerHotelBooking {
    checkIn: Temporal.PlainDate;
    checkOut: Temporal.PlainDate;
    hotelName: string;
    roomName: string;
    sharingWith: string[];
}

/**
 * Request-cached query loading confirmed hotel room bookings for `userId` in `eventId`.
 */
const loadVolunteerHotelBookings = cache(
    async (eventId: number, userId: number): Promise<VolunteerHotelBooking[]> => {
        const dbInstance = db;

        const firstUserJoin = tUsers.forUseInLeftJoinAs('fu');
        const secondUserJoin = tUsers.forUseInLeftJoinAs('su');
        const thirdUserJoin = tUsers.forUseInLeftJoinAs('tu');

        const rows = await dbInstance.selectFrom(tHotelsBookings)
            .innerJoin(tHotels)
                .on(tHotels.hotelId.equals(tHotelsBookings.bookingHotelId))
                    .and(tHotels.hotelRoomDeleted.isNull())
            .leftJoin(firstUserJoin)
                .on(firstUserJoin.userId.equals(tHotelsBookings.bookingFirstUserId))
            .leftJoin(secondUserJoin)
                .on(secondUserJoin.userId.equals(tHotelsBookings.bookingSecondUserId))
            .leftJoin(thirdUserJoin)
                .on(thirdUserJoin.userId.equals(tHotelsBookings.bookingThirdUserId))
            .where(tHotelsBookings.eventId.equals(eventId))
                .and(tHotelsBookings.bookingConfirmed.isNotNull())
                .and(tHotelsBookings.bookingDeleted.isNull())
                .and(tHotelsBookings.bookingFirstUserId.equals(userId).or(
                    tHotelsBookings.bookingSecondUserId.equals(userId)).or(
                    tHotelsBookings.bookingThirdUserId.equals(userId)))
            .select({
                checkIn: tHotelsBookings.bookingCheckIn,
                checkOut: tHotelsBookings.bookingCheckOut,
                hotelName: tHotels.hotelName,
                roomName: tHotels.hotelRoomName,
                firstUserId: tHotelsBookings.bookingFirstUserId,
                firstName: tHotelsBookings.bookingFirstName.valueWhenNull(firstUserJoin.name),
                secondUserId: tHotelsBookings.bookingSecondUserId,
                secondName: tHotelsBookings.bookingSecondName.valueWhenNull(secondUserJoin.name),
                thirdUserId: tHotelsBookings.bookingThirdUserId,
                thirdName: tHotelsBookings.bookingThirdName.valueWhenNull(thirdUserJoin.name),
            })
            .orderBy('checkIn', 'asc')
            .executeSelectMany();

        return rows.map(row => {
            const sharingWith: string[] = [];
            if (row.firstUserId !== userId && row.firstName)
                sharingWith.push(row.firstName);
            if (row.secondUserId !== userId && row.secondName)
                sharingWith.push(row.secondName);
            if (row.thirdUserId !== userId && row.thirdName)
                sharingWith.push(row.thirdName);

            return {
                checkIn: row.checkIn,
                checkOut: row.checkOut,
                hotelName: row.hotelName,
                roomName: row.roomName,
                sharingWith,
            };
        });
    });

/**
 * Returns confirmed hotel room bookings for `userId` in `event`, including basic room details and
 * the names of any roommates sharing each booking. Returns an empty array when hotel management is
 * disabled for the event or no confirmed bookings exist.
 */
export async function getVolunteerHotelBookings(
    event: Pick<CachedEvent, 'flags' | 'id'>, userId: number): Promise<VolunteerHotelBooking[]>
{
    if (!event.flags.enableHotel)
        return [];

    return loadVolunteerHotelBookings(event.id, userId);
}
