// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import type { NextPageParams } from '@lib/NextRouterParams';
import { Temporal } from '@lib/Temporal';
import db, { tEvents } from '@lib/database';

interface TitleCache {
    cache: Map<string, string>;
    expiration: Temporal.Instant;
}

declare namespace globalThis {
    let animeConScheduleEventNameCache: Map<string, string>;
    let animeConScheduleTitleCache: Map<string, TitleCache>;
}

/**
 * Cache from event slug to event short name to avoid repeated requests. May be stale when events
 * get renamed, but that can be rectified by restarting the Docker container.
 */
globalThis.animeConScheduleEventNameCache = new Map;

/**
 * Maximum time that a title cache may live for. Will automatically be cleared after this time.
 */
const kTitleCacheExpirationTimeSeconds = /* 15 minutes= */ 900;

/**
 * Cache for arbitrary title caching done by sub-pages of the schedule app. May be stale when things
 * get renamed; lives for a maximum of `kTitleCacheExpirationTimeSeconds` seconds.
 */
globalThis.animeConScheduleTitleCache = new Map;

/**
 * Generates metadata for a page with the given `title`. A Next.js `Metadata` object will be
 * returned that can be used directly on a page.
 */
export async function generateScheduleMetadata(props: NextPageParams<'event'>, title?: string[])
    : Promise<Metadata>
{
    const params = await props.params;

    let eventName = globalThis.animeConScheduleEventNameCache.get(params.event);
    if (!eventName) {
        eventName = await db.selectFrom(tEvents)
            .where(tEvents.eventSlug.equals(params.event))
            .selectOneColumn(tEvents.eventShortName)
            .executeSelectNoneOrOne() ?? 'AnimeCon';

        globalThis.animeConScheduleEventNameCache.set(params.event, eventName);
    }

    if (!!title)
        return { title: `${title.join(' | ')} | ${eventName}` };
    else
        return { title: eventName };
}

/**
 * Generates metadata for a page with the given `title`. A function will be returned that also reads
 * the event's slug, for which we will substitute the event's short name in the title.
 */
export function generateScheduleMetadataFn(title?: string[]) {
    return (props: NextPageParams<'event'>): Promise<Metadata> =>
        generateScheduleMetadata(props, title);
}

/**
 * Retrieves a title cache for the given `cacheIdentifier`. The cache will automatically expire
 * after a certain period of time.
 */
export function getTitleCache(cacheIdentifier: string): Map<string, string> {
    const currentTime = Temporal.Now.instant();

    let titleCache = globalThis.animeConScheduleTitleCache.get(cacheIdentifier);
    if (!titleCache || Temporal.Instant.compare(currentTime, titleCache.expiration) >= 0) {
        globalThis.animeConScheduleTitleCache.set(cacheIdentifier, {
            cache: new Map,
            expiration: currentTime.add({ seconds: kTitleCacheExpirationTimeSeconds }),
        });

        titleCache = globalThis.animeConScheduleTitleCache.get(cacheIdentifier)!;
    }

    return titleCache.cache;
}
