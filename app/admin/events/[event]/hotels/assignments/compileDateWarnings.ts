// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { formatDate, isBefore } from '@lib/Temporal';
import db, { tHotelsBookings, tUsers, tUsersEvents, tUsersEventsPreferencesHotel }
    from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Formats a list of ISO date strings into a comma-separated list of weekday names.
 */
function formatDays(dates: Iterable<string>): string {
    return [ ...dates ].sort().map(date => formatDate(Temporal.PlainDate.from(date), 'dddd'))
        .join(', ');
}

/**
 * Expands a check-in and check-out range into individual date strings (`YYYY-MM-DD`).
 */
function* iterateNights(start?: Temporal.PlainDate, end?: Temporal.PlainDate): Generator<string> {
    if (!start || !end)
        return;

    for (let date = start; isBefore(date, end); date = date.add({ days: 1 }))
        yield date.toString();
}

/**
 * Compiles a list of date-related warnings for the hotel bookings in the given `eventId`.
 */
export async function compileDateWarnings(eventId: number) {
    const firstUserJoin = tUsers.forUseInLeftJoinAs('fu');
    const secondUserJoin = tUsers.forUseInLeftJoinAs('su');
    const thirdUserJoin = tUsers.forUseInLeftJoinAs('tu');

    const dbInstance = db;
    const bookings = await dbInstance.selectFrom(tHotelsBookings)
        .leftJoin(firstUserJoin)
            .on(firstUserJoin.userId.equals(tHotelsBookings.bookingFirstUserId))
        .leftJoin(secondUserJoin)
            .on(secondUserJoin.userId.equals(tHotelsBookings.bookingSecondUserId))
        .leftJoin(thirdUserJoin)
            .on(thirdUserJoin.userId.equals(tHotelsBookings.bookingThirdUserId))
        .where(tHotelsBookings.eventId.equals(eventId))
            .and(tHotelsBookings.bookingDeleted.isNull())
        .select({
            checkIn: tHotelsBookings.bookingCheckIn,
            checkOut: tHotelsBookings.bookingCheckOut,

            firstUserId: tHotelsBookings.bookingFirstUserId,
            firstName: tHotelsBookings.bookingFirstName.valueWhenNull(firstUserJoin.name),

            secondUserId: tHotelsBookings.bookingSecondUserId,
            secondName: tHotelsBookings.bookingSecondName.valueWhenNull(secondUserJoin.name),

            thirdUserId: tHotelsBookings.bookingThirdUserId,
            thirdName: tHotelsBookings.bookingThirdName.valueWhenNull(thirdUserJoin.name),
        })
        .executeSelectMany();

    const volunteers = new Map<number, {
        name: string;
        bookedNights: Set<string>;
        duplicateNights: Set<string>;
    }>();

    for (const booking of bookings) {
        const occupants = [
            { userId: booking.firstUserId, name: booking.firstName },
            { userId: booking.secondUserId, name: booking.secondName },
            { userId: booking.thirdUserId, name: booking.thirdName },
        ];

        for (const { userId, name } of occupants) {
            if (!userId || !name)
                continue;

            let volunteer = volunteers.get(userId);
            if (!volunteer) {
                volunteer = { name, bookedNights: new Set(), duplicateNights: new Set() };
                volunteers.set(userId, volunteer);
            }

            for (const night of iterateNights(booking.checkIn, booking.checkOut)) {
                if (volunteer.bookedNights.has(night))
                    volunteer.duplicateNights.add(night);

                volunteer.bookedNights.add(night);
            }
        }
    }

    if (!volunteers.size)
        return [];

    const preferencesJoin = tUsersEventsPreferencesHotel.forUseInLeftJoin();

    const participants = await dbInstance.selectFrom(tUsersEvents)
        .leftJoin(preferencesJoin)
            .on(preferencesJoin.userId.equals(tUsersEvents.userId))
                .and(preferencesJoin.eventId.equals(tUsersEvents.eventId))
                .and(preferencesJoin.preferenceVersionIsLatest.equals(/* true= */ 1))
                .and(preferencesJoin.hotelInterested.equals(/* true= */ 1))
                .and(preferencesJoin.hotelRoomId.isNotNull())
        .where(tUsersEvents.eventId.equals(eventId))
            .and(tUsersEvents.userId.in([ ...volunteers.keys() ]))
            .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
        .select({
            userId: tUsersEvents.userId,
            checkIn: preferencesJoin.hotelCheckIn,
            checkOut: preferencesJoin.hotelCheckOut,
        })
        .groupBy(tUsersEvents.userId)
        .executeSelectMany();

    const participantMap = new Map(participants.map(p => [ p.userId, p ]));
    const warnings: { volunteer: string; warning: string }[] = [];

    for (const [ userId, { name, bookedNights, duplicateNights } ] of volunteers.entries()) {
        const participant = participantMap.get(userId);
        if (!participant) {
            warnings.push({
                volunteer: name,
                warning: 'is assigned to a booking, but is no longer participating.',
            });
            continue;
        }

        if (duplicateNights.size > 0) {
            warnings.push({
                volunteer: name,
                warning: `is assigned to multiple rooms on ${formatDays(duplicateNights)}.`,
            });
        }

        const expectedNights = new Set(iterateNights(participant.checkIn, participant.checkOut));
        const excessNights = bookedNights.difference(expectedNights);
        const missingNights = expectedNights.difference(bookedNights);

        if (excessNights.size > 0) {
            warnings.push({
                volunteer: name,
                warning:
                    `is assigned a room that they didn't request on ${formatDays(excessNights)}.`,
            });
        }

        if (missingNights.size > 0) {
            warnings.push({
                volunteer: name,
                warning: `requested a room on ${formatDays(missingNights)} that hasn't been booked.`,
            });
        }
    }

    warnings.sort((lhs, rhs) => lhs.volunteer.localeCompare(rhs.volunteer));
    return warnings;
}
