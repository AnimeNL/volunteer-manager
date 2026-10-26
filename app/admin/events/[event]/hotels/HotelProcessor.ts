// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { formatDate, isBefore } from '@lib/Temporal';
import db, { tHotels, tHotelsAssignments, tHotelsBookings, tTeams, tUsers, tUsersEvents,
    tUsersEventsPreferencesHotel } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Record detailing the information stored about an assignment. Roughly maps to the
 * `hotels_assignments` table.
 */
interface AssignmentRecord {
    id: number;
    userId?: number;
    name?: string;
    bookingHotelId?: number;
    bookingCheckIn: Temporal.PlainDate;
    bookingCheckOut: Temporal.PlainDate;
}

/**
 * Record detailing the information stored about a hotel room. Roughly maps to the `hotels` table.
 */
interface HotelRecord {
    id: number;
    hotelName: string;
    hotelDescription: string;
    roomName: string;
    visible: boolean;
}

/**
 * Record detailing the information stored about hotel preferences. Roughly maps to the
 * `users_events_preferences_hotel` table, and includes anyone who has expressed their preferences.
 */
interface PreferenceRecord {
    userId: number;
    name: string;
    team: string;
    hotelId?: number;
    checkIn?: Temporal.PlainDate;
    checkOut?: Temporal.PlainDate;
    updated: Temporal.ZonedDateTime;
}

/**
 * Type defining how we represent a warning in our system.
 */
type Warning = { volunteer: string, warning: string };

/**
 * The `HotelProcessor` class retrieves all hotel-associated information for a particular event and
 * is able to run logic operations on that data, such as partial views and warning generation.
 */
export class HotelProcessor {
    #eventId: number;

    #assignments: Map</* assignmentId= */ number, AssignmentRecord> = new Map;
    #hotels: Map</* hotelId= */ number, HotelRecord> = new Map;
    #preferences: Map</* userId= */ number, PreferenceRecord> = new Map;

    #assignmentsForUsers: Set</* userId= */ number> = new Set;

    constructor(eventId: number) {
        this.#eventId = eventId;
    }

    async initialise() {
        const usersJoin = tUsers.forUseInLeftJoin();

        const assignments = await db.selectFrom(tHotelsAssignments)
            .innerJoin(tHotelsBookings)
                .on(tHotelsBookings.bookingId.equals(tHotelsAssignments.bookingId))
                    .and(tHotelsBookings.bookingVisible.equals(/* true= */ 1))
            .leftJoin(usersJoin)
                .on(usersJoin.userId.equals(tHotelsAssignments.assignmentUserId))
            .where(tHotelsAssignments.eventId.equals(this.#eventId))
            .select({
                id: tHotelsAssignments.assignmentId,
                userId: tHotelsAssignments.assignmentUserId,
                name: tHotelsAssignments.assignmentName.valueWhenNull(
                    usersJoin.name),

                bookingHotelId: tHotelsBookings.bookingHotelId,
                bookingCheckIn: tHotelsBookings.bookingCheckIn,
                bookingCheckOut: tHotelsBookings.bookingCheckOut,
            })
            .executeSelectMany();

        for (const assignment of assignments) {
            this.#assignments.set(assignment.id, assignment);

            if (!!assignment.userId)
                this.#assignmentsForUsers.add(assignment.userId);
        }

        const hotels = await db.selectFrom(tHotels)
            .where(tHotels.eventId.equals(this.#eventId))
                .and(tHotels.hotelRoomDeleted.isNull())
            .select({
                id: tHotels.hotelId,
                hotelName: tHotels.hotelName,
                hotelDescription: tHotels.hotelDescription,
                roomName: tHotels.hotelRoomName,
                visible: tHotels.hotelRoomVisible.equals(/* true= */ 1)
            })
            .orderBy('hotelName', 'asc')
                .orderBy('roomName', 'asc')
            .executeSelectMany();

        for (const hotel of hotels)
            this.#hotels.set(hotel.id, hotel);

        const preferences = await db.selectFrom(tUsersEventsPreferencesHotel)
            .innerJoin(tUsers)
                .on(tUsers.userId.equals(tUsersEventsPreferencesHotel.userId))
            .innerJoin(tUsersEvents)
                .on(tUsersEvents.userId.equals(tUsersEventsPreferencesHotel.userId))
                    .and(tUsersEvents.eventId.equals(tUsersEventsPreferencesHotel.eventId))
                    .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
            .innerJoin(tTeams)
                .on(tTeams.teamId.equals(tUsersEvents.teamId))
            .where(tUsersEventsPreferencesHotel.eventId.equals(this.#eventId))
                .and(tUsersEventsPreferencesHotel.preferenceVersionIsLatest.equals(/* true= */ 1))
                .and(tUsersEventsPreferencesHotel.hotelRoomId.isNotNull())
            .select({
                userId: tUsersEventsPreferencesHotel.userId,
                name: tUsers.name,
                team: tTeams.teamSlug,
                hotelId: tUsersEventsPreferencesHotel.hotelRoomId,
                checkIn: tUsersEventsPreferencesHotel.hotelCheckIn,
                checkOut: tUsersEventsPreferencesHotel.hotelCheckOut,
                updated: tUsersEventsPreferencesHotel.preferenceVersion,
            })
            .orderBy('name', 'asc')
            .executeSelectMany();

        for (const preference of preferences)
            this.#preferences.set(preference.userId, preference);
    }

    /**
     * Returns a list of warnings that should be displayed on the hotel room overview.
     */
    compileWarnings(): Warning[] {
        const warnings: Warning[] = [];
        const volunteers = new Map<number, AssignmentRecord[]>;

        for (const assignment of this.#assignments.values()) {
            if (!!assignment.bookingHotelId && !this.#hotels.has(assignment.bookingHotelId)) {
                warnings.push({
                    volunteer: assignment.name!,
                    warning: 'is assigned to a hotel room that no longer exists.',
                });
            }

            if (!!assignment.userId) {
                if (volunteers.has(assignment.userId))
                    volunteers.get(assignment.userId)!.push(assignment);
                else
                    volunteers.set(assignment.userId, [ assignment ]);

                const preferences = this.#preferences.get(assignment.userId);
                if (!preferences) {
                    warnings.push({
                        volunteer: assignment.name!,
                        warning: 'is assigned to a booking, but is no longer participating.',
                    });
                } else if (!preferences.hotelId) {
                    warnings.push({
                        volunteer: assignment.name!,
                        warning: 'is assigned to a booking, but indicated to not want a hotel room.'
                    });
                } else if (assignment.bookingHotelId !== preferences.hotelId) {
                    warnings.push({
                        volunteer: assignment.name!,
                        warning: 'is assigned to a hotel room different from their preferences.',
                    });
                }

                continue;
            }

            if (!assignment.bookingHotelId) {
                warnings.push({
                    volunteer: assignment.name!,
                    warning: 'is assigned to a booking that doesn\'t have an associated room.',
                });
            }
        }

        function format(dates: string[]): string {
            return dates.sort().map(date => formatDate(Temporal.PlainDate.from(date), 'dddd'))
                .join(', ');
        }

        for (const assignments of volunteers.values()) {
            const { userId, name } = assignments[0];

            const preferences = this.#preferences.get(userId!);
            if (!preferences || !preferences.checkIn || !preferences.checkOut)
                continue;  // the "no longer participating" warning will have been shown

            const bookedNights = new Set<string>;
            const bookedNightsWarnings = new Set<string>;
            const expectedNights = new Set<string>;

            for (const assignment of assignments) {
                let date = assignment.bookingCheckIn;
                for (; isBefore(date, assignment.bookingCheckOut); date = date.add({ days: 1 })) {
                    const dateString = date.toString();
                    if (bookedNights.has(dateString))
                        bookedNightsWarnings.add(dateString);

                    bookedNights.add(dateString);
                }
            }

            if (!!bookedNightsWarnings.size) {
                warnings.push({
                    volunteer: name!,
                    warning:
                        `is assigned to multiple rooms on ${format([ ...bookedNightsWarnings ])}.`
                });
            }

            let date = preferences.checkIn;
            for (; isBefore(date, preferences.checkOut); date = date.add({ days: 1 }))
                expectedNights.add(date.toString());

            const excessDays: string[] = [];
            const missingDays: string[] = [];

            const difference = bookedNights.symmetricDifference(expectedNights);
            for (const day of difference) {
                if (bookedNights.has(day))
                    excessDays.push(day);
                else
                    missingDays.push(day);
            }

            if (!!excessDays.length) {
                warnings.push({
                    volunteer: name!,
                    warning:
                        `is assigned a room that they didn't request on ${format(excessDays)}.`
                });
            }

            if (!!missingDays.length) {
                warnings.push({
                    volunteer: name!,
                    warning:
                        `requested a room on ${format(missingDays)} that hasn't been booked.`,
                })
            }
        }

        warnings.sort((lhs, rhs) => lhs.volunteer.localeCompare(rhs.volunteer));
        return warnings;
    }

    /**
     * Returns a list of the volunteers who have requested a room during the event.
     */
    composeRequestOptions(): string[] {
        return [ ...this.#preferences.values() ].map(preferences => preferences.name);
    }

    /**
     * Returns a list of the visible hotel room options known to this processor. Only options that
     * have not been removed will be considered.
     */
    composeRoomOptions(): { value: number, label: string }[] {
        return [ ...this.#hotels.values() ].filter(hotel => !!hotel.visible).map(hotel => ({
            value: hotel.id,
            label: `${hotel.hotelName} (${hotel.roomName})`,
        }));
    }
}
