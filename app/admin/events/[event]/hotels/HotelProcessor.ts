// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { HotelPendingRequestRowModel } from './HotelPendingAssignment';
import { formatDate, isBefore } from '@lib/Temporal';
import db, { tHotels, tHotelsAssignments, tHotelsBookings, tHotelsPreferences, tTeams, tUsers, tUsersEvents }
    from '@lib/database';

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
 * `hotels_preferences` table, and includes anyone who has expressed their preferences.
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

        const preferences = await db.selectFrom(tHotelsPreferences)
            .innerJoin(tUsers)
                .on(tUsers.userId.equals(tHotelsPreferences.userId))
            .innerJoin(tUsersEvents)
                .on(tUsersEvents.userId.equals(tHotelsPreferences.userId))
                    .and(tUsersEvents.eventId.equals(tHotelsPreferences.eventId))
                    .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
            .innerJoin(tTeams)
                .on(tTeams.teamId.equals(tHotelsPreferences.teamId))
            .where(tHotelsPreferences.eventId.equals(this.#eventId))
                .and(tHotelsPreferences.hotelId.isNotNull())
            .select({
                userId: tHotelsPreferences.userId,
                name: tUsers.name,
                team: tTeams.teamSlug,
                hotelId: tHotelsPreferences.hotelId,
                checkIn: tHotelsPreferences.hotelDateCheckIn,
                checkOut: tHotelsPreferences.hotelDateCheckOut,
                updated: tHotelsPreferences.hotelPreferencesUpdated,
            })
            .orderBy('name', 'asc')
            .executeSelectMany();

        for (const preference of preferences)
            this.#preferences.set(preference.userId, preference);
    }

    /**
     * Returns a list of the hotel requests that have not been fulfilled yet.
     */
    compileUnassignedRequests(): HotelPendingRequestRowModel[] {
        const unassignedRequests: HotelPendingRequestRowModel[] = [];
        for (const request of this.#preferences.values()) {
            if (this.#assignmentsForUsers.has(request.userId))
                continue;  // the volunteer already has an assigned room

            if (!request.hotelId || !request.checkIn || !request.checkOut)
                continue;  // the volunteer doesn't want a hotel room

            const hotel = this.#hotels.get(request.hotelId);
            if (!hotel)
                throw new Error(`Invalid hotel room specified for volunteer ${request.userId}`)

            unassignedRequests.push({
                id: request.userId,
                name: request.name,
                team: request.team,
                hotel: `${hotel.hotelName} (${hotel.roomName})`,
                checkIn: request.checkIn.toString(),
                checkOut: request.checkOut.toString(),
                requested: formatDate(request.updated, 'YYYY-MM-DD'),
            });
        }

        unassignedRequests.sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));
        return unassignedRequests;
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
