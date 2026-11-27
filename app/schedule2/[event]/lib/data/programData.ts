// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';
import { cache } from 'react';

import db, { tUsersEventsFavourites } from '@lib/database';

/**
 * Request-cached loader returning the set of AnPlan activity IDs favourited by `userId` in
 * `eventId`.
 */
export const getFavouritedActivityIds = cache(
    async (eventId: number, userId: number): Promise<Set<number>> => {
        const activityIds = await db.selectFrom(tUsersEventsFavourites)
            .where(tUsersEventsFavourites.userId.equals(userId))
                .and(tUsersEventsFavourites.eventId.equals(eventId))
            .selectOneColumn(tUsersEventsFavourites.activityId)
            .executeSelectMany();

        return new Set(activityIds);
    });
