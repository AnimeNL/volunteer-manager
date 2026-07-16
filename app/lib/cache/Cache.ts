// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { CacheContents, CacheDescriptor, CacheParameters, CacheType } from './CacheDescriptors';
import { kCacheDescriptor } from './CacheDescriptors';

/**
 * Utility type representing the function to call when a cache has to be populated.
 */
type CachePopulateFn<T extends CacheType> =
    (params: CacheParameters<T>) => Promise<CacheContents<T> | null>;

/**
 * General purpose caching mechanism used throughout the Volunteer Manager. Strongly typed, and
 * automatically applies pruning behaviour such as expiration times.
 */
export class Cache<T extends CacheType> {
    /**
     * Retrieves the cache with the given |name|. Will throw when an invalid |name| is given.
     */
    static get<T extends CacheType>(type: T): Cache<T> {
        if (!Object.hasOwn(kCacheDescriptor, type))
            throw new Error(`Unknown cache type given: ${type}`);

        return new Cache(kCacheDescriptor[type]);
    }

    // ---------------------------------------------------------------------------------------------

    #descriptor: CacheDescriptor<T>;

    private constructor(descriptor: CacheDescriptor<T>) {
        this.#descriptor = descriptor;
    }

    /**
     * Returns the descriptor that describes the purpose of this cache.
     */
    get descriptor() { return this.#descriptor; }

    /**
     * Returns from the cache for the given |params|. When the associated content does not exist in
     * the cache yet, it will be populated based on the given |populateFn|.
     */
    async get(params: CacheParameters<T>, populateFn: CachePopulateFn<T>)
        : Promise<CacheContents<T> | null>
    {
        // todo
        return populateFn(params);
    }

    /**
     * Invalidates all cached entities, optionally filtered by the |params|.
     */
    invalidate(): void {
        // todo
    }

    /**
     * Iterator that allows the user of a cache to iterate over all cached content. Used to enable
     * introspectability of the caches from user interfaces.
     */
    [Symbol.iterator](): Iterator<[ CacheParameters<T>, CacheContents<T> | null ]> {
        // todo
        return {
            next() { return { done: true, value: null }; },
        };
    }
}
