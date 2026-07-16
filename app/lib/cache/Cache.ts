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
    /**
     * Parameters with which this cache entry has been associated.
     */
    params: CacheParameters<T>;

    /**
     * Contents stored within this cache entry. May be `null`, but not `undefined`.
     */
    contents: CacheContents<T> | null;

    /**
     * Time at which this cache entry expires.
     */
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
 * Arguments expected by the cache accessors, i.e. `get()` and `has()`.
 */
type CacheAccessArgs<T extends CacheType> =
    [CacheParameters<T>] extends [undefined] ? [] : [ params: CacheParameters<T> ];

/**
 * Arguments expected by the cache deletion method, i.e. `delete()`.
 */
type CacheDeleteArgs<T extends CacheType> =
    [CacheParameters<T>] extends [undefined] ? [] : [ params: Partial<CacheParameters<T>> ];

/**
 * Arguments expected by the cache getter method, i.e. `getOrInsert()`.
 */
type CacheGetOrInsertArgs<T extends CacheType> = [CacheParameters<T>] extends [undefined]
    ? [ populateFn: CachePopulateFn<T> ]
    : [ params: CacheParameters<T>, populateFn: CachePopulateFn<T> ];

/**
 * Arguments expected by the cache setter method, i.e. `set()`.
 */
type CacheSetArgs<T extends CacheType> = [CacheParameters<T>] extends [undefined]
    ? [ contents: CacheContents<T> ]
    : [ params: CacheParameters<T>, contents: CacheContents<T> ];

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
    delete(...args: CacheDeleteArgs<T>): void;
    delete(params?: any) {
        this.pruneExpiredEntries();

        for (const [ key, entry ] of this.#entries) {
            const entryParams = entry.params;
            let matches = params === entryParams;
            if (!matches && typeof params === 'object' && params !== null &&
                typeof entryParams === 'object' && entryParams !== null)
            {
                matches = true;
                for (const k of Object.keys(params)) {
                    if ((entryParams)[k as keyof typeof entryParams] !== params[k]) {
                        matches = false;
                        break;
                    }
                }
            }

            if (matches)
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
    get(...args: CacheAccessArgs<T>): CacheContents<T> | null | undefined;
    get(params?: any): CacheContents<T> | null | undefined {
        this.pruneExpiredEntries();

        const key = serializeParams(params);
        const entry = this.#entries.get(key);

        return entry ? entry.contents : undefined;
    }

    /**
     * Returns the value corresponding to the given |params|, or populates the cache with the given
     * |populateFn|.
     */
    getOrInsert(...args: CacheGetOrInsertArgs<T>): Promise<CacheContents<T> | null>;
    async getOrInsert(paramsOrPopulateFn: any, populateFn?: any)
        : Promise<CacheContents<T> | null>
    {
        this.pruneExpiredEntries();

        let params: CacheParameters<T>;
        let fn: CachePopulateFn<T>;

        if (populateFn === undefined) {
            params = undefined;
            fn = paramsOrPopulateFn;
        } else {
            params = paramsOrPopulateFn;
            fn = populateFn;
        }

        const key = serializeParams(params);

        const entry = this.#entries.get(key);
        if (entry)
            return entry.contents;

        const contents = await fn(params);
        const ttl = this.#descriptor.ttl;

        this.#entries.set(key, {
            params,
            contents: contents,
            expiresAt: ttl > 0 ? performance.now() + ttl * 1000 : null
        });

        return contents;
    }

    /**
     * Returns whether the cache has a value corresponding to the given |params|.
     */
    has(...args: CacheAccessArgs<T>): boolean;
    has(params?: any): boolean {
        this.pruneExpiredEntries();
        return this.#entries.has(serializeParams(params));
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
    set(...args: CacheSetArgs<T>): void;
    set(paramsOrContents: any, contents?: any) {
        this.pruneExpiredEntries();

        let params: CacheParameters<T>;
        let finalContents: CacheContents<T>;

        if (contents === undefined) {
            params = undefined;
            finalContents = paramsOrContents;
        } else {
            params = paramsOrContents;
            finalContents = contents;
        }

        const key = serializeParams(params);
        const ttl = this.#descriptor.ttl;

        this.#entries.set(key, {
            params,
            contents: finalContents,
            expiresAt: ttl > 0 ? performance.now() + ttl * 1000 : null
        });
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
        const now = performance.now();

        for (const [ key, entry ] of this.#entries) {
            if (entry.expiresAt !== null && now >= entry.expiresAt)
                this.#entries.delete(key);
        }
    }
}
