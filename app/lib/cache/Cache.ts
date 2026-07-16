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
     * Removes all elements from this cache.
     */
    clear() {
        // todo
    }

    /**
     * Removes all elements from this cache that match the |params|.
     */
    delete(params: Partial<CacheParameters<T>>) {
        // todo
    }

    /**
     * Returns an iterator object that contains the [ params, contents ] pairs for all entries.
     */
    entries(): Iterator<[ CacheParameters<T>, CacheContents<T> | null ]> {
        // todo
        return {
            next() { return { done: true, value: null }; },
        };
    }

    /**
     * Returns the value corresponding to the given |params|. Defaults to `undefined`.
     */
    get(params: CacheParameters<T>): CacheContents<T> | null | undefined {
        // todo
        return undefined;
    }

    /**
     * Returns the value corresponding to the given |params|, or populates the cache with the given
     * |populateFn|.
     */
    async getOrInsert(params: CacheParameters<T>, populateFn: CachePopulateFn<T>)
        : Promise<CacheContents<T> | null>
    {
        // todo
        return populateFn(params);
    }

    /**
     * Returns whether the cache has a value corresponding to the given |params|.
     */
    has(params: CacheParameters<T>): boolean {
        // todo
        return false;
    }

    /**
     * Returns the parameters for all entries in the cache.
     */
    params(): Iterator<CacheParameters<T>> {
        // todo
        return {
            next() { return { done: true, value: null }; },
        };
    }

    /**
     * Sets the value corresponding to the given |params| to |contents|.
     */
    set(params: CacheParameters<T>, contents: CacheContents<T>) {
        // todo
    }

    /**
     * Returns the values for all entries in the cache.
     */
    values(): Iterator<CacheContents<T> | null> {
        // todo
        return {
            next() { return { done: true, value: null }; },
        };
    }

    /**
     * Returns an iterator object that contains the [ params, contents ] pairs for all entries.
     */
    [Symbol.iterator](): Iterator<[ CacheParameters<T>, CacheContents<T> | null ]> {
        return this.entries();
    }
}
