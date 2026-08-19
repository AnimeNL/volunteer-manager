// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import db, { tHotels } from '@lib/database';

/**
 * Fetches available hotel rooms for the given event ID.
 */
export async function getHotelRooms(eventId: number) {
    return await db.selectFrom(tHotels)
        .where(tHotels.eventId.equals(eventId))
            .and(tHotels.hotelRoomVisible.equals(1))
            .and(tHotels.hotelRoomDeleted.isNull())
        .select({
            id: tHotels.hotelId,
            label: tHotels.hotelName.concat(' - ').concat(tHotels.hotelRoomName),
        })
        .orderBy('label', 'asc')
        .executeSelectMany();
}
