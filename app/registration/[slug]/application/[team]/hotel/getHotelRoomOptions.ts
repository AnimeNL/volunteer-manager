// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import db, { tHotels } from '@lib/database';

/**
 * Returns the hotel room options that are available for `eventId`, formatted in a manner that's
 * appropriate to be used on the hotel room preference form.
 */
export async function getHotelRoomOptions(eventId: number) {
    const hotelOptions = await db.selectFrom(tHotels)
        .where(tHotels.eventId.equals(eventId))
            .and(tHotels.hotelRoomVisible.equals(/* true= */ 1))
            .and(tHotels.hotelRoomDeleted.isNull())
        .select({
            hotelId: tHotels.hotelId,
            hotelName: tHotels.hotelName,
            hotelRoom: tHotels.hotelRoomName,
            hotelRoomPeople: tHotels.hotelRoomPeople,
            hotelRoomPrice: tHotels.hotelRoomPrice,
        })
        .orderBy(tHotels.hotelName, 'asc')
        .orderBy(tHotels.hotelRoomName, 'asc')
        .executeSelectMany();

    const kPriceFormatter = new Intl.NumberFormat('en-UK', { style: 'currency', currency: 'EUR' });
    return hotelOptions.map(option => {
        const price = kPriceFormatter.format(option.hotelRoomPrice / 100);
        return {
            id: option.hotelId,
            label: `${option.hotelName} (${option.hotelRoom}) - ${price}/room/night`,
        };
    });
}
