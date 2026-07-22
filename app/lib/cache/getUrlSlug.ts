// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Cache } from './Cache';
import db, { tEvents, tTeams } from '@lib/database';

/**
 * Returns the slug belonging to either the `event` or `team`, or undefined when it does not exist.
 */
export async function getUrlSlug(params: { event: number } | { team: number })
    : Promise<string | undefined>
{
    return await Cache.getInstance('UrlSlugs').getOrInsert(params, async (params) => {
        if ('event' in params) {
            return db.selectFrom(tEvents)
                .where(tEvents.eventId.equals(params.event))
                .selectOneColumn(tEvents.eventSlug)
                .executeSelectNoneOrOne();
        } else {
            return db.selectFrom(tTeams)
                .where(tTeams.teamId.equals(params.team))
                .selectOneColumn(tTeams.teamSlug)
                .executeSelectNoneOrOne();
        }
    }) ?? undefined;
}

/**
 * Invalidates all cached URL slug information for the given `event` or `team`.
 */
export function invalidateUrlSlug(params: { event: number } | { team: number }): void {
    Cache.getInstance('UrlSlugs').delete(params);
}
