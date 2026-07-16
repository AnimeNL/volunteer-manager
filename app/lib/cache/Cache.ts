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
 * Interface representing an entry in the Cache.
 */
interface CacheEntry<T extends CacheType> {
    params: CacheParameters<T>;
    contents: CacheContents<T> | null;
    expiresAt: number | null;
}

/**
 * Serializes parameters to a stable string representation for map key storage.
 */
function serializeParams(params: any): string {
    if (params === undefined || params === null)
        return '';

    if (typeof params !== 'object')
        return String(params);

    const keys = Object.keys(params).sort();
    const sortedObj: Record<string, any> = {};
    for (const key of keys)
        sortedObj[key] = params[key];

    return JSON.stringify(sortedObj);
}

/**
 * Checks if the entry parameters match the partial filter parameters.
 */
function matchesParams<P>(entryParams: P, filterParams: Partial<P>): boolean {
    if (filterParams === entryParams)
        return true;

    if (typeof filterParams === 'object' && filterParams !== null &&
        typeof entryParams === 'object' && entryParams !== null)
    {
        for (const key of Object.keys(filterParams)) {
            if ((entryParams as any)[key] !== (filterParams as any)[key])
                return false;
        }
        return true;
    }

    return false;
}

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

    /**
     * Global shared storage map for all caches, mapping from cache name to its entry map.
     */
    static #cacheStorage = new Map<CacheType, Map<string, any>>();

    // ---------------------------------------------------------------------------------------------

    #descriptor: CacheDescriptor<T>;
    #entries: Map<string, CacheEntry<T>>;

    private constructor(descriptor: CacheDescriptor<T>) {
        this.#descriptor = descriptor;

        let entries = Cache.#cacheStorage.get(descriptor.name);
        if (!entries) {
            entries = new Map();
            Cache.#cacheStorage.set(descriptor.name, entries);
        }

        this.#entries = entries;
    }

    /**
     * Returns the descriptor that describes the purpose of this cache.
     */
    get descriptor() { return this.#descriptor; }

    /**
     * Removes all elements from this cache.
     */
    clear() { this.#entries.clear(); }

    /**
     * Removes all elements from this cache that match the |params|.
     */
    delete(params: Partial<CacheParameters<T>>) {
        this.pruneExpiredEntries();

        for (const [ key, entry ] of this.#entries) {
            if (matchesParams(entry.params, params))
                this.#entries.delete(key);
        }
    }

    /**
     * Returns an iterator object that contains the [ params, contents ] pairs for all entries.
     */
    entries(): Iterator<[ CacheParameters<T>, CacheContents<T> | null ]> {
        this.pruneExpiredEntries();
        return this.#entries.values().map(entry => [ entry.params, entry.contents ]);
    }

    /**
     * Returns the value corresponding to the given |params|. Defaults to `undefined`.
     */
    get(params: CacheParameters<T>): CacheContents<T> | null | undefined {
        this.pruneExpiredEntries();
        const key = serializeParams(params);
        const entry = this.#entries.get(key);
        return entry ? entry.contents : undefined;
    }

    /**
     * Returns the value corresponding to the given |params|, or populates the cache with the given
     * |populateFn|.
     */
    async getOrInsert(params: CacheParameters<T>, populateFn: CachePopulateFn<T>)
        : Promise<CacheContents<T> | null>
    {
        this.pruneExpiredEntries();
        const key = serializeParams(params);
        const entry = this.#entries.get(key);
        if (entry)
            return entry.contents;

        const contents = await populateFn(params);
        this.set(params, contents as any);
        return contents;
    }

    /**
     * Returns whether the cache has a value corresponding to the given |params|.
     */
    has(params: CacheParameters<T>): boolean {
        this.pruneExpiredEntries();
        const key = serializeParams(params);
        return this.#entries.has(key);
    }

    /**
     * Returns the parameters for all entries in the cache.
     */
    params(): Iterator<CacheParameters<T>> {
        this.pruneExpiredEntries();
        return this.#entries.values().map(entry => entry.params);
    }

    /**
     * Sets the value corresponding to the given |params| to |contents|.
     */
    set(params: CacheParameters<T>, contents: CacheContents<T>) {
        this.pruneExpiredEntries();
        const key = serializeParams(params);
        const ttl = this.#descriptor.ttl;
        const expiresAt = ttl > 0 ? Date.now() + ttl * 1000 : null;
        this.#entries.set(key, { params, contents, expiresAt });
    }

    /**
     * Returns the values for all entries in the cache.
     */
    values(): Iterator<CacheContents<T> | null> {
        this.pruneExpiredEntries();
        return this.#entries.values().map(entry => entry.contents);
    }

    /**
     * Returns an iterator object that contains the [ params, contents ] pairs for all entries.
     */
    [Symbol.iterator](): Iterator<[ CacheParameters<T>, CacheContents<T> | null ]> {
        return this.entries();
    }

    // ---------------------------------------------------------------------------------------------

    /**
     * Prunes all expired elements from this cache.
     */
    private pruneExpiredEntries() {
        const now = Date.now();

        for (const [key, entry] of this.#entries) {
            if (entry.expiresAt !== null && now >= entry.expiresAt)
                this.#entries.delete(key);
        }
    }
}
