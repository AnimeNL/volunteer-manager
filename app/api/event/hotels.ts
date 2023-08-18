// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod';

import type { ActionProps } from '../Action';
import db, { tEvents, tHotels } from '@lib/database';

/**
 * Interface definition for the Hotel API, exposed through /api/event/hotels.
 */
export const kHotelsDefinition = z.object({
    request: z.object({
        /**
         * Unique slug of the event for which to fetch hotel room information.
         */
        event: z.string(),
    }),
    response: z.strictObject({
        /**
         * The hotels which have rooms available for this event.
         */
        hotels: z.array(z.strictObject({
            /**
             * Name of the hotel.
             */
            name: z.string(),

            /**
             * Description of the hotel. May contain Markdown content.
             */
            description: z.string(),

            /**
             * The hotel rooms that are available in this hotel.
             */
            rooms: z.array(z.strictObject({
                /**
                 * Unique ID of this room in the database.
                 */
                id: z.number(),

                /**
                 * Name of the hotel room.
                 */
                name: z.string(),

                /**
                 * How many people can stay in this hotel room?
                 */
                people: z.number(),

                /**
                 * Price of this hotel room per night, in cents. (I.e. €184.50 would be 18450.)
                 */
                price: z.number(),
            })),
        })),
    }),
});

export type HotelsDefinition = z.infer<typeof kHotelsDefinition>;

type Request = HotelsDefinition['request'];
type Response = HotelsDefinition['response'];

/**
 * API through which visitors can retrieve information about the hotel rooms available for an event.
 * These are the same regardless of volunteering team, but may not be available to everybody.
 */
export async function hotels(request: Request, props: ActionProps): Promise<Response> {
    const configuration = await db.selectFrom(tEvents)
        .innerJoin(tHotels)
            .on(tHotels.eventId.equals(tEvents.eventId))
        .where(tEvents.eventSlug.equals(request.event))
            .and(tHotels.hotelRoomVisible.equals(/* visible= */ 1))
        .select({
            hotelId: tHotels.hotelId,
            hotelName: tHotels.hotelName,
            hotelDescription: tHotels.hotelDescription,
            roomName: tHotels.hotelRoomName,
            roomPeople: tHotels.hotelRoomPeople,
            roomPrice: tHotels.hotelRoomPrice,
        })
        .orderBy(tHotels.hotelName, 'asc')
        .orderBy(tHotels.hotelRoomPeople, 'asc')
        .orderBy(tHotels.hotelRoomName, 'asc')
        .executeSelectMany();

    const hotels = new Map<string, Response['hotels'][number]>();
    for (const row of configuration) {
        if (!hotels.has(row.hotelName)) {
            hotels.set(row.hotelName, {
                name: row.hotelName,
                description: row.hotelDescription,
                rooms: [ /* to be added */],
            });
        }

        hotels.get(row.hotelName)!.rooms.push({
            id: row.hotelId,
            name: row.roomName,
            people: row.roomPeople,
            price: row.roomPrice,
        });
    }

    return { hotels: [ ...hotels.values() ] };
}
