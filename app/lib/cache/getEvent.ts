// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { CachedEvent } from './Types';
import { Cache } from './Cache';
import { getUrlSlug, invalidateUrlSlug } from './getUrlSlug';
import db, { tEvents } from '@lib/database';

/**
 * Returns basic information about the given `event` uniquely identified by either its ID or slug.
 * Will in most cases return cached information, but might end up issuing a database query.
 */
export async function getEvent(event: number | string): Promise<CachedEvent | undefined> {
    let slug: string;
    if (typeof event === 'string') {
        slug = event;
    } else {
        slug = (await getUrlSlug({ event }))!;
        if (!slug)
            return undefined;
    }

    return await Cache.getInstance('EventCache').getOrInsert(slug, async (slug) => {
        return db.selectFrom(tEvents)
            .where(tEvents.eventSlug.equals(slug))
            .select({
                id: tEvents.eventId,
                slug: tEvents.eventSlug,
                name: tEvents.eventName,
                shortName: tEvents.eventShortName,
            })
            .executeSelectNoneOrOne();

    }) ?? undefined;
}

/**
 * Invalidates all cached representations of the `event` identified by either its ID or slug.
 */
export async function invalidateEventCache(event: number | string): Promise<void> {
    const cache = Cache.getInstance('EventCache');

    if (typeof event === 'string' && cache.has(event)) {
        const { id } = cache.get(event)!;

        cache.delete(event);

        invalidateUrlSlug({ event: id });

    } else if (typeof event === 'number') {
        const slug = await getUrlSlug({ event });
        if (!!slug)
            cache.delete(slug);

        invalidateUrlSlug({ event });
    }
}
