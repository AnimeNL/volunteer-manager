// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { DBConnection } from '@lib/database/Connection';
import { tUsersEventsFavourites } from '@lib/database';

/**
 * Implementation of a mechanism that allows favourited events to be cached in this instance of the
 * Volunteer Manager, which avoids needing database queries every time the information is needed.
 */
export class FavouriteCache {
    static #cache: Map<string, Record<string, true>> = new Map;

    /**
     * Clears any cached favourite activities for the given |userId|.
     */
    static clear(eventId: number, userId: number): void {
        FavouriteCache.#cache.delete(`${userId}:${eventId}`);
    }

    /**
     * Obtains the favourited activities for the given { eventId, userId } pair. May run a database
     * query when the information has not been cached yet.
     */
    static async read(dbInstance: DBConnection, eventId: number, userId: number) {
        const key = `${userId}:${eventId}`;

        const cachedValue = FavouriteCache.#cache.get(key);
        if (cachedValue !== undefined)
            return cachedValue;

        const favouriteActivities = await dbInstance.selectFrom(tUsersEventsFavourites)
            .where(tUsersEventsFavourites.userId.equals(userId))
                .and(tUsersEventsFavourites.eventId.equals(eventId))
            .selectOneColumn(tUsersEventsFavourites.activityId)
            .executeSelectMany();

        const favourites: Record<string, true> = {};
        for (const activityId of favouriteActivities)
            favourites[`${activityId}`] = true;

        FavouriteCache.#cache.set(key, favourites);

        return favourites;
    }
}
