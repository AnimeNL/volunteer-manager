// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { CachedEvent } from '@lib/cache';
import type { EventState } from './EventState';
import type { EventStateDataSource } from './EventStateLoader';
import { Cache, getEvent } from '@lib/cache';
import { EventStateCacheEntry } from './EventStateCacheEntry';
import { EventStateLoader } from './EventStateLoader';

/**
 * Coordinates cached `EventState` retrieval and lazy slice reloads over `@lib/cache`
 * (`EventState`). Production code accesses the shared instance via
 * `EventStateStore.getInstance()`, while unit tests can instantiate an isolated store with a
 * custom `EventStateDataSource`.
 */
export class EventStateStore {
    static #instance?: EventStateStore;

    readonly #cache: Cache<'EventState'>;
    readonly #dataSource: EventStateDataSource;

    /**
     * Returns the process-wide `EventStateStore` backed by the database `EventStateLoader` and
     * the shared `EventState` cache.
     */
    static getInstance(): EventStateStore {
        EventStateStore.#instance ??= new EventStateStore();
        return EventStateStore.#instance;
    }

    constructor(
        dataSource: EventStateDataSource = new EventStateLoader(),
        cache: Cache<'EventState'> = Cache.getInstance('EventState'))
    {
        this.#dataSource = dataSource;
        this.#cache = cache;
    }

    /**
     * Retrieves or lazily builds the cached `EventState` for `event` (accepting either an event
     * ID, event slug, or already-resolved `CachedEvent`). Returns `undefined` when the event does
     * not exist.
     */
    async get(event: CachedEvent | number | string): Promise<EventState | undefined> {
        const cachedEvent = typeof event === 'object' ? event : await getEvent(event);
        if (!cachedEvent)
            return undefined;

        let entry = this.#cache.get(cachedEvent.id);
        if (!entry) {
            entry = new EventStateCacheEntry();
            this.#cache.set(cachedEvent.id, entry);
        }

        return await entry.ensureFresh(cachedEvent, this.#dataSource);
    }
}

/**
 * Retrieves or lazily builds the cached `EventState` for `event`.
 */
export function getEventState(
    event: CachedEvent | number | string): Promise<EventState | undefined>
{
    return EventStateStore.getInstance().get(event);
}
