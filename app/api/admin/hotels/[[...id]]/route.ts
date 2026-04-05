// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { type DataTableEndpoints, createDataTableApi } from '@app/api/createDataTableApi';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { getEventBySlug } from '@lib/EventLoader';
import db, { tHotels, tHotelsAssignments, tHotelsBookings, tHotelsPreferences, tUsers } from '@lib/database';

/**
 * Row model for an hotel entry, as can be shown and modified in the administration area.
 */
const kHotelRowModel = z.object({
    /**
     * Unique ID of this entry in the configuration.
     */
    id: z.number(),

    /**
     * Description of the hotel in which the room is located.
     */
    hotelDescription: z.string(),

    /**
     * Name of the hotel in which the room is located.
     */
    hotelName: z.string(),

    /**
     * Name of the room that can be booked.
     */
    roomName: z.string(),

    /**
     * Capacity of the room.
     */
    roomPeople: z.number(),

    /**
     * Price of the room, in cents.
     */
    roomPrice: z.number(),
});

/**
 * Context required for the API.
 */
const kHotelContext = z.object({
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
export type HotelsEndpoints =
    DataTableEndpoints<typeof kHotelRowModel, typeof kHotelContext>;

/**
 * Row model expected by the API.
 */
export type HotelsRowModel = z.infer<typeof kHotelRowModel>;

/**
 * Implementation of the API.
 *
 * The following endpoints are provided by this implementation:
 *
 *     GET    /api/admin/hotels
 *     POST   /api/admin/hotesl
 *     DELETE /api/admin/hotels/:id
 *     PUT    /api/admin/hotels/:id
 */
export const { DELETE, POST, PUT, GET } =
createDataTableApi(kHotelRowModel, kHotelContext, {
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

        const insertId = await db.insertInto(tHotels)
            .set({
                eventId: event.id,
                hotelRoomPeople: 1,
                hotelRoomPrice: 10000,
            })
            .returningLastInsertedId()
            .executeInsert();

        return {
            success: true,
            row: {
                id: insertId,
                hotelDescription: '',
                hotelName: '',
                roomName: '',
                roomPeople: 1,
                roomPrice: 10000,
            },
        };
    },

    async delete({ context, id }) {
        const event = await getEventBySlug(context.event);
        if (!event)
            notFound();

        const dbInstance = db;

        // Confirm that there are no users who have selected this room as their preference:
        const usersWithPreference = await dbInstance.selectFrom(tHotelsPreferences)
            .innerJoin(tUsers)
                .on(tUsers.userId.equals(tHotelsPreferences.userId))
            .where(tHotelsPreferences.hotelId.equals(id))
            .selectOneColumn(tUsers.name)
            .orderBy(tUsers.name, 'asc')
            .executeSelectMany();

        if (usersWithPreference.length > 1000) {
            return {
                success: false,
                error: 'One or more user(s) have selected this hotel room as their preference (' +
                    usersWithPreference.join(', ') + ').',
            };
        }

        const usersJoin = tUsers.forUseInLeftJoin();

        // Confirm that there are no users who have been assigned to this hotel room:
        const usersWithBookings = await dbInstance.selectFrom(tHotelsBookings)
            .innerJoin(tHotelsAssignments)
                .on(tHotelsAssignments.bookingId.equals(tHotelsBookings.bookingId))
            .leftJoin(usersJoin)
                .on(usersJoin.userId.equals(tHotelsAssignments.assignmentUserId))
            .where(tHotelsBookings.bookingHotelId.equals(id))
            .selectOneColumn(tHotelsAssignments.assignmentName.valueWhenNull(usersJoin.name))
            .executeSelectMany();

        if (usersWithBookings.length > 0) {
            const uniqueNamesWithBookings = [ ...new Set(usersWithBookings) ].sort();
            return {
                success: false,
                error: 'One or more user(s) have bookings for this hotel room (' +
                    uniqueNamesWithBookings.join(', ') + ').',
            };
        }

        // Only now (soft) delete the actual hotel room:
        const affectedRows = await dbInstance.update(tHotels)
            .set({
                hotelRoomDeleted: dbInstance.currentZonedDateTime()
            })
            .where(tHotels.hotelId.equals(id))
                .and(tHotels.eventId.equals(event.id))
                .and(tHotels.hotelRoomVisible.equals(/* true= */ 1))
                .and(tHotels.hotelRoomDeleted.isNull())
            .executeUpdate();

        return { success: !!affectedRows };
    },

    async list({ context, sort }) {
        const event = await getEventBySlug(context.event);
        if (!event)
            notFound();

        const hotels = await db.selectFrom(tHotels)
            .select({
                id: tHotels.hotelId,
                hotelDescription: tHotels.hotelDescription,
                hotelName: tHotels.hotelName,
                roomName: tHotels.hotelRoomName,
                roomPeople: tHotels.hotelRoomPeople,
                roomPrice: tHotels.hotelRoomPrice,
                visible: tHotels.hotelRoomVisible.equals(/* true= */ 1),
            })
            .where(tHotels.eventId.equals(event.id))
                .and(tHotels.hotelRoomVisible.equals(/* true= */ 1))
            .orderBy(sort?.field ?? 'hotelName', sort?.sort ?? 'asc')
                .orderBy(tHotels.hotelRoomName, 'asc')
            .executeSelectPage();

        return {
            success: true,
            rowCount: hotels.count,
            rows: hotels.data,
        };
    },

    async update({ context, id, row }) {
        const event = await getEventBySlug(context.event);
        if (!event)
            notFound();

        const affectedRows = await db.update(tHotels)
            .set({
                hotelName: row.hotelName,
                hotelDescription: row.hotelDescription,
                hotelRoomName: row.roomName,
                hotelRoomPeople: row.roomPeople,
                hotelRoomPrice: row.roomPrice,
            })
            .where(tHotels.hotelId.equals(id))
                .and(tHotels.eventId.equals(event.id))
                .and(tHotels.hotelRoomVisible.equals(/* true= */ 1))
            .executeUpdate();

        return { success: !!affectedRows };
    },

    async writeLog({ context }, mutation, props) {
        const event = await getEventBySlug(context.event);
        RecordLog({
            type: kLogType.AdminEventHotelMutation,
            severity: kLogSeverity.Info,
            sourceUser: props.user,
            data: {
                eventName: event?.shortName,
                mutation,
            },
        });
    },
});
