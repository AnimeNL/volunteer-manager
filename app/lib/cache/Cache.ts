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
 * Metadata associated with a CacheEntry.
 */
interface CacheEntryMetadata {
    /**
     * Number of times this entry has been accessed.
     */
    accessCount: number;

    /**
     * Number of bytes stored in this cache entry.
     */
    bytes: number;

    /**
     * Timestamp, as a `performance.now()` monotonically increasing time, of the last access.
     */
    lastAccessTime: number;
}

/**
 * Interface representing an entry in the Cache.
 */
interface CacheEntry<T extends CacheType> extends CacheEntryMetadata {
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
 * Calculates the size of cache contents in bytes.
 */
function calculateByteSize(contents: any): number {
    if (contents === null || contents === undefined)
        return 0;

    if (contents instanceof Uint8Array || contents instanceof ArrayBuffer)
        return contents.byteLength;
    if (Buffer.isBuffer(contents))
        return contents.length;

    let serialized: string;
    if (typeof contents === 'string') {
        serialized = contents;
    } else {
        try {
            serialized = JSON.stringify(contents);
        } catch {
            return 0;
        }
    }

    return new TextEncoder().encode(serialized).length;
}

/**
 * The Volunteer Manager supports three kinds of data caches: permanent ones, that have to be
 * cleared manually. Expiration-based caches with a TTL for each entry in the cache, and finally
 * size-based caches with a maximum number of entries, which will be pruned by the LRU.
 *
 * Caches retain metadata on each entry in the cache for introspectability, such as the number of
 * times an entry has been accessed and the timestamp of the most recent access.
 *
 * Each data cache must be defined using a descriptor in CacheDescriptors.ts to ensure both type
 * safety, and well defined intented behaviour of the cache throughout the system.
 */
export class Cache<T extends CacheType> {
    /**
     * Retrieves all non-internal cache instances.
     */
    static getAll(): Cache<CacheType>[] {
        return Object.keys(kCacheDescriptor)
            .filter(type => !kCacheDescriptor[type as CacheType].internal)
            .map(type => Cache.getInstance(type as CacheType));
    }

    /**
     * Retrieves the cache with the given |name|. Will throw when an invalid |name| is given.
     */
    static getInstance<T extends CacheType>(type: T): Cache<T> {
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
    *entries(): IterableIterator<[ CacheParameters<T>, CacheContents<T> | null ]> {
        this.pruneExpiredEntries();
        for (const entry of this.#entries.values())
            yield [ entry.params, entry.contents ];
    }

    /**
     * Returns an iterator that, for each entry in the cache, returns the metadata.
     */
    *metadata(): IterableIterator<CacheEntryMetadata> {
        this.pruneExpiredEntries();
        for (const entry of this.#entries.values()) {
            yield {
                accessCount: entry.accessCount,
                bytes: entry.bytes,
                lastAccessTime: entry.lastAccessTime,
            };
        }
    }

    /**
     * Returns the value corresponding to the given |params|. Defaults to `undefined`.
     */
    get(...args: CacheAccessArgs<T>): CacheContents<T> | null | undefined;
    get(params?: any): CacheContents<T> | null | undefined {
        this.pruneExpiredEntries();

        const key = serializeParams(params);
        const entry = this.#entries.get(key);

        if (entry) {
            entry.accessCount++;
            entry.lastAccessTime = performance.now();

            if (this.#descriptor.type === 'lru') {
                this.#entries.delete(key);
                this.#entries.set(key, entry);
            }
        }

        return entry ? entry.contents : undefined;
    }

    /**
     * Returns the value corresponding to the given |params|, or populates the cache with the given
     * |populateFn|.
     */
    getOrInsert(...args: CacheGetOrInsertArgs<T>): Promise<CacheContents<T> | null>;
    async getOrInsert(paramsOrPopulateFn: any, maybePopulateFn?: any)
        : Promise<CacheContents<T> | null>
    {
        this.pruneExpiredEntries();

        let params: CacheParameters<T>;
        let populateFn: CachePopulateFn<T>;

        if (maybePopulateFn === undefined) {
            params = undefined;
            populateFn = paramsOrPopulateFn;
        } else {
            params = paramsOrPopulateFn;
            populateFn = maybePopulateFn;
        }

        const key = serializeParams(params);

        const entry = this.#entries.get(key);
        if (entry) {
            entry.accessCount++;
            entry.lastAccessTime = performance.now();

            if (this.#descriptor.type === 'lru') {
                this.#entries.delete(key);
                this.#entries.set(key, entry);
            }

            return entry.contents;
        }

        const contents = await populateFn(params);
        this.set(...[ params, contents ] as CacheSetArgs<T>);

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
    *params(): IterableIterator<CacheParameters<T>> {
        this.pruneExpiredEntries();
        for (const entry of this.#entries.values())
            yield entry.params;
    }

    /**
     * Sets the value corresponding to the given |params| to |contents|.
     */
    set(...args: CacheSetArgs<T>): void;
    set(paramsOrContents: any, maybeContents?: any) {
        this.pruneExpiredEntries();

        let params: CacheParameters<T>;
        let contents: CacheContents<T>;

        if (maybeContents === undefined) {
            params = undefined;
            contents = paramsOrContents;
        } else {
            params = paramsOrContents;
            contents = maybeContents;
        }

        const key = serializeParams(params);
        const descriptor = this.#descriptor;

        let expiresAt: number | null = null;
        if (descriptor.type === 'ttl')
            expiresAt = performance.now() + descriptor.ttl * 1000;

        this.#entries.delete(key);

        this.#entries.set(key, {
            params, contents, expiresAt,

            accessCount: 1,
            bytes: calculateByteSize(contents),
            lastAccessTime: performance.now(),
        });

        if (descriptor.type === 'lru') {
            while (this.#entries.size > descriptor.maxSize) {
                const firstKey = this.#entries.keys().next().value;
                if (firstKey !== undefined)
                    this.#entries.delete(firstKey);
                else
                    break;
            }
        }
    }

    /**
     * Returns the values for all entries in the cache.
     */
    *values(): IterableIterator<CacheContents<T> | null> {
        this.pruneExpiredEntries();
        for (const entry of this.#entries.values())
            yield entry.contents;
    }

    /**
     * Returns an iterator object that contains the [ params, contents ] pairs for all entries.
     */
    [Symbol.iterator]() { return this.entries(); }

    // ---------------------------------------------------------------------------------------------

    /**
     * Prunes all expired elements from this cache.
     */
    private pruneExpiredEntries() {
        if (this.#descriptor.type !== 'ttl')
            return;

        const now = performance.now();

        for (const [ key, entry ] of this.#entries) {
            if (entry.expiresAt !== null && now >= entry.expiresAt)
                this.#entries.delete(key);
        }
    }
}
