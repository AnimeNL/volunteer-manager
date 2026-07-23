// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { type DataTableEndpoints, createDataTableApi } from '@app/api/createDataTableApi';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { getEventBySlug } from '@lib/EventLoader';
import { getHotelBookings, type HotelsAssignmentsRowModel } from './getHotelBookings';
import db, { tHotelsAssignments, tHotelsBookings, tUsers, tUsersEvents } from '@lib/database';

import { kRegistrationStatus } from '@lib/database/Types';

/**
 * Row model for an hotel assignment, as can be shown and modified in the administration area.
 */
const kHotelAssignmentRowModel = z.object({
/**
     * Unique ID of this entry in the configuration.
     */
    id: z.number(),

    /**
     * Name and user ID of the assignment's first occupant.
     */
    firstName: z.string().optional(),
    firstUserId: z.number().optional(),
    firstTeam: z.string().optional(),

    /**
     * Name and user ID of the assignment's second occupant.
     */
    secondName: z.string().optional(),
    secondUserId: z.number().optional(),
    secondTeam: z.string().optional(),

    /**
     * Name and user ID of the assignment's third occupant.
     */
    thirdName: z.string().optional(),
    thirdUserId: z.number().optional(),
    thirdTeam: z.string().optional(),

    /**
     * ID of the hotel (& room) option that this assignment is associated with.
     */
    hotelId: z.number().optional(),

    /**
     * Date (YYYY-MM-DD) on which the assignees will be checking in.
     */
    checkIn: z.string().regex(/^\d{4}\-\d{2}\-\d{2}$/),

    /**
     * Date (YYYY-MM-DD) on which the assignees will be checking out.
     */
    checkOut: z.string().regex(/^\d{4}\-\d{2}\-\d{2}$/),

    /**
     * Whether the hotel assignment has been confirmed.
     */
    confirmed: z.boolean(),
});

/**
 * Context required for the API.
 */
const kHotelAssignmentContext = z.object({
    context: z.object({
        /**
         * Unique slug of the event that the request is in scope of.
         */
        event: z.string(),
    }),
});

/**
 * Enable use of the API in `callApi()`.
 */
export type HotelsAssignmentsEndpoints =
    DataTableEndpoints<typeof kHotelAssignmentRowModel, typeof kHotelAssignmentContext>;

export type { HotelsAssignmentsRowModel } from './getHotelBookings';

/**
 * Individual hotel assignment, either as a user (`number`) or as an invitee (`string`).
 */
type HotelAssignment = number | string;

/**
 * Determines the intended assignments based on the given `row`. Only names will be consumed, which
 * will automagically be linked to users when they participate in the given `eventId`.
 */
async function determineAssignmentsFromRow(eventId: number, row: HotelsAssignmentsRowModel) {
    const assignments: HotelAssignment[] = [];

    const names: string[] = [];
    if (!!row.firstName)
        names.push(row.firstName);
    if (!!row.secondName)
        names.push(row.secondName);
    if (!!row.thirdName)
        names.push(row.thirdName);

    // Bail out if there are no assignments for the current room.
    if (!names.length)
        return assignments;

    const usersEventsJoin = tUsersEvents.forUseInLeftJoin();
    const users = await db.selectFrom(tUsers)
        .leftJoin(usersEventsJoin)
            .on(usersEventsJoin.userId.equals(tUsers.userId))
                .and(usersEventsJoin.eventId.equals(eventId))
                .and(usersEventsJoin.registrationStatus.in(
                    [ kRegistrationStatus.Accepted, kRegistrationStatus.Cancelled ]))
        .where(tUsers.name.in(names))
            .and(usersEventsJoin.teamId.isNotNull())
        .select({
            userId: tUsers.userId,
            name: tUsers.name,
        })
        .executeSelectMany();

    for (const assignedName of names) {
        let found = false;

        for (const { userId, name } of users) {
            if (name !== assignedName)
                continue;

            assignments.push(userId);
            found = true;
        }

        if (!found)
            assignments.push(assignedName);
    }

    return assignments;
}

/**
 * Implementation of the API.
 *
 * The following endpoints are provided by this implementation:
 *
 *     GET    /api/admin/hotels/assignments
 *     POST   /api/admin/hotels/assignments
 *     DELETE /api/admin/hotels/assignments/:id
 *     PUT    /api/admin/hotels/assignments/:id
 */
export const { DELETE, POST, PUT, GET } =
createDataTableApi(kHotelAssignmentRowModel, kHotelAssignmentContext, {
    async accessCheck({ context }, action, props) {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin-event',
            event: context.event,
            permission: {
                permission: 'event.hotels',
                scope: {
                    event: context.event,
                },
            },
        });
    },

    async create({ context }) {
        const event = await getEventBySlug(context.event);
        if (!event)
            notFound();

        const bookingCheckIn = Temporal.PlainDate.from(event.startTime);
        const bookingCheckOut = Temporal.PlainDate.from(event.endTime);

        const insertId = await db.insertInto(tHotelsBookings)
            .set({
                eventId: event.id,
                bookingHotelId: null,
                bookingCheckIn,
                bookingCheckOut,
                bookingConfirmed: /* false= */ 0,
                bookingVisible: /* true= */ 1,
            })
            .returningLastInsertedId()
            .executeInsert();

        return {
            success: true,
            row: {
                id: insertId,
                checkIn: bookingCheckIn.toString(),
                checkOut: bookingCheckOut.toString(),
                confirmed: false,
            },
        };
    },

    async delete({ context, id }, props) {
        const event = await getEventBySlug(context.event);
        if (!event)
            notFound();

        const bookings = await getHotelBookings(event.id, id);
        if (!bookings || !bookings.length)
            notFound();

        const booking = bookings[0];

        const affectedRows = await db.update(tHotelsBookings)
            .set({
                bookingVisible: /* false= */ 0
            })
            .where(tHotelsBookings.bookingId.equals(id))
                .and(tHotelsBookings.eventId.equals(event.id))
            .executeUpdate();

        if (!!affectedRows) {
            for (const uid of [ booking.firstUserId, booking.secondUserId, booking.thirdUserId ]) {
                if (!!uid) {
                    RecordLog({
                        type: kLogType.AdminHotelAssignVolunteerDelete,
                        severity: kLogSeverity.Warning,
                        sourceUser: props.user,
                        targetUser: uid,
                        data: {
                            event: event.shortName,
                        }
                    });
                }
            }
        }

        return { success: !!affectedRows };
    },

    async list({ context }) {
        const event = await getEventBySlug(context.event);
        if (!event)
            notFound();

        const bookings = await getHotelBookings(event.id);
        return {
            success: true,
            rowCount: bookings.length,
            rows: bookings,
        };
    },

    async update({ context, id, row }, props) {
        const event = await getEventBySlug(context.event);
        if (!event)
            notFound();

        const bookings = await getHotelBookings(event.id, id);
        if (!bookings || !bookings.length)
            notFound();

        const booking = bookings[0];

        const affectedRows = await db.update(tHotelsBookings)
            .set({
                bookingHotelId: row.hotelId,
                bookingCheckIn: Temporal.PlainDate.from(row.checkIn),
                bookingCheckOut: Temporal.PlainDate.from(row.checkOut),
                bookingConfirmed: row.confirmed ? 1 : 0,
            })
            .where(tHotelsBookings.bookingId.equals(id))
                .and(tHotelsBookings.eventId.equals(event.id))
            .executeUpdate();

        const existingAssignments: HotelAssignment[] = [];
        if (!!booking.firstName)
            existingAssignments.push(booking.firstUserId ?? booking.firstName);
        if (!!booking.secondName)
            existingAssignments.push(booking.secondUserId ?? booking.secondName);
        if (!!booking.thirdName)
            existingAssignments.push(booking.thirdUserId ?? booking.thirdName);

        const updatedAssignments: HotelAssignment[] =
            await determineAssignmentsFromRow(event.id, row);

        const assignmentsUpdated =
            existingAssignments[0] !== updatedAssignments[0] ||
            existingAssignments[1] !== updatedAssignments[1] ||
            existingAssignments[2] !== updatedAssignments[2];

        if (assignmentsUpdated) {
            const dbInstance = db;
            await dbInstance.transaction(async () => {
                await dbInstance.deleteFrom(tHotelsAssignments)
                    .where(tHotelsAssignments.bookingId.equals(id))
                        .and(tHotelsAssignments.eventId.equals(event.id))
                    .executeDelete();

                await dbInstance.insertInto(tHotelsAssignments)
                    .values(updatedAssignments.map((assignment, index) => ({
                        bookingId: id,
                        eventId: event.id,
                        assignmentUserId: typeof assignment === 'number' ? assignment : null,
                        assignmentName: typeof assignment === 'string' ? assignment : null,
                        assignmentPrimary: index === 0 ? /* true= */ 1 : /* false= */ 0,
                    })))
                    .executeInsert();
            });

            const existingAssignmentSet = new Set([ ...existingAssignments ]);
            const updatedAssignmentSet = new Set([ ...updatedAssignments ]);

            for (const assignment of existingAssignmentSet.values()) {
                if (typeof assignment !== 'number')
                    continue;  // only log unassignments associated with volunteers
                if (updatedAssignmentSet.has(assignment))
                    continue;  // the volunteer still has an assignment

                RecordLog({
                    type: kLogType.AdminHotelAssignVolunteerDelete,
                    severity: kLogSeverity.Warning,
                    sourceUser: props.user,
                    targetUser: assignment,
                    data: {
                        event: event.shortName,
                    }
                });
            }

            for (const assignment of updatedAssignmentSet.values()) {
                if (typeof assignment !== 'number')
                    continue;  // only log assignments associated with volunteers
                if (existingAssignmentSet.has(assignment))
                    continue;  // the volunteer already had an assignment

                RecordLog({
                    type: kLogType.AdminHotelAssignVolunteer,
                    severity: kLogSeverity.Warning,
                    sourceUser: props.user,
                    targetUser: assignment,
                    data: {
                        event: event.shortName,
                    }
                });
            }
        }

        return { success: !!affectedRows };
    },

    async writeLog({ context }, mutation, props) {
        const event = await getEventBySlug(context.event);
        RecordLog({
            type: kLogType.AdminHotelBookingMutation,
            severity: kLogSeverity.Info,
            sourceUser: props.user,
            data: {
                event: event?.shortName,
                mutation,
            },
        });
    },
});
