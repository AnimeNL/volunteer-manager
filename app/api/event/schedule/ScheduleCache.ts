// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Enumeration of the types of cache that the ScheduleCache can contain.
 */
type ScheduleCacheType = 'knowledge';

/**
 * Implementation of a generic cache that allows query data to be cached until the cache is cleared.
 */
export class ScheduleCache {
    static #cache: Map<string, ScheduleCache> = new Map;

    /**
     * Clears any data that's stored for the given `type` and `eventId` tuple.
     */
    static clear(type: ScheduleCacheType, eventId: number) {
        ScheduleCache.#cache.delete(ScheduleCache.getCacheKey(type, eventId));
    }

    /**
     * Gets the ScheduleCache instance for the given `type` and `eventId` tuple.
     */
    static for(type: ScheduleCacheType, eventId: number) {
        const cacheKey = ScheduleCache.getCacheKey(type, eventId);
        if (!ScheduleCache.#cache.has(cacheKey))
            ScheduleCache.#cache.set(cacheKey, new ScheduleCache());

        return ScheduleCache.#cache.get(cacheKey)!;
    }

    /**
     * Composes a consistent key string for the given `type` and `eventId` tuple.
     */
    private static getCacheKey(type: ScheduleCacheType, eventId: number) {
        return `${type}:${eventId}`;
    }

    #cachedValue: any;
    #cachedValueSet: boolean = false;

    private constructor() { /* do nothing */ }

    /**
     * Returns the cached value when available, otherwise creates it using the `createFn`.
     */
    getOrCreate<T>(createFn: () => T): T {
        if (this.#cachedValueSet)
            return this.#cachedValue;

        this.#cachedValue = createFn();
        this.#cachedValueSet = true;

        return this.#cachedValue;
    }
}
