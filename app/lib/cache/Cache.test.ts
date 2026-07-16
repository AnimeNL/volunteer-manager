// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Cache } from './Cache';
import { kCacheDescriptor } from './CacheDescriptors';

describe('Cache', () => {
    beforeEach(() => {
        // Clear all entries from the shared storage before each test
        const cache = Cache.getInstance('ManifestLatestEvent');
        cache.clear();
        const adminCache = Cache.getInstance('AdminNavigationActiveEvents');
        adminCache.clear();

        // Clear any dynamic test caches if registered
        if (Object.hasOwn(kCacheDescriptor, 'TestCacheWithTTL')) {
            const ttlCache = Cache.getInstance('TestCacheWithTTL');
            ttlCache.clear();
        }
        if (Object.hasOwn(kCacheDescriptor, 'TestCacheWithParams')) {
            const paramsCache = Cache.getInstance('TestCacheWithParams');
            paramsCache.clear();
        }
    });

    it('should throw for unknown cache types', () => {
        expect(() => Cache.getInstance('InvalidType' as any))
            .toThrow('Unknown cache type given: InvalidType');
    });

    it('should share underlying storage between instances of the same cache type', () => {
        const cache1 = Cache.getInstance('ManifestLatestEvent');
        const cache2 = Cache.getInstance('ManifestLatestEvent');
        const cache3 = Cache.getInstance('AdminNavigationActiveEvents');

        // Set on cache1, should be visible on cache2 but not cache3
        const manifestData = { name: 'AnimeCon 2026', fullName: 'AnimeCon 2026 Event' };
        cache1.set(manifestData);

        expect(cache2.has()).toBeTruthy();
        expect(cache2.get()).toEqual(manifestData);

        expect(cache3.has({ limit: 10 })).toBeFalsy();
    });

    it('should support basic get, set, has, and clear operations', () => {
        const cache = Cache.getInstance('AdminNavigationActiveEvents');

        const params1 = { limit: 5 };
        const data1 = { concluded: false, label: 'Event 1', slug: 'event-1' };

        const params2 = { limit: 10 };
        const data2 = { concluded: true, label: 'Event 2', slug: 'event-2' };

        expect(cache.has(params1)).toBeFalsy();
        expect(cache.get(params1)).toBeUndefined();

        cache.set(params1, data1);
        expect(cache.has(params1)).toBeTruthy();
        expect(cache.get(params1)).toEqual(data1);

        cache.set(params2, data2);
        expect(cache.has(params2)).toBeTruthy();
        expect(cache.get(params2)).toEqual(data2);

        cache.clear();
        expect(cache.has(params1)).toBeFalsy();
        expect(cache.has(params2)).toBeFalsy();
    });

    it('should handle getOrInsert with population functions, including null values', async () => {
        const cache = Cache.getInstance('AdminNavigationActiveEvents');
        const params = { limit: 5 };
        const data = { concluded: false, label: 'Event 1', slug: 'event-1' };

        let callCount = 0;
        const populateFn = async () => {
            callCount++;
            return data;
        };

        // First call: should run the populate function and cache the result
        const result1 = await cache.getOrInsert(params, populateFn);
        expect(result1).toEqual(data);
        expect(callCount).toEqual(1);

        // Second call: should retrieve from cache without running the populate function
        const result2 = await cache.getOrInsert(params, populateFn);
        expect(result2).toEqual(data);
        expect(callCount).toEqual(1);

        // Clear and test populating with null
        cache.clear();
        let nullCallCount = 0;
        const populateNullFn = async () => {
            nullCallCount++;
            return null;
        };

        const resultNull1 = await cache.getOrInsert(params, populateNullFn);
        expect(resultNull1).toBeNull();
        expect(nullCallCount).toEqual(1);

        const resultNull2 = await cache.getOrInsert(params, populateNullFn);
        expect(resultNull2).toBeNull();
        expect(nullCallCount).toEqual(1);
    });

    it('should support deleting entries by partial parameter matches', () => {
        const cache = Cache.getInstance('TestCacheWithParams');

        const entry1 = { a: 1, b: 'foo' };
        const entry2 = { a: 1, b: 'bar' };
        const entry3 = { a: 2, b: 'foo' };

        cache.set(entry1, 'data1');
        cache.set(entry2, 'data2');
        cache.set(entry3, 'data3');

        // Delete with partial match { a: 1 } should delete entry1 and entry2 but keep entry3
        cache.delete({ a: 1 });
        expect(cache.has(entry1)).toBeFalsy();
        expect(cache.has(entry2)).toBeFalsy();
        expect(cache.has(entry3)).toBeTruthy();

        // Delete with partial match { b: 'foo' } should delete entry3
        cache.delete({ b: 'foo' });
        expect(cache.has(entry3)).toBeFalsy();
    });

    it('should support iterating over entries, values, and params', () => {
        const cache = Cache.getInstance('AdminNavigationActiveEvents');

        const params1 = { limit: 5 };
        const data1 = { concluded: false, label: 'Event 1', slug: 'event-1' };

        const params2 = { limit: 10 };
        const data2 = { concluded: true, label: 'Event 2', slug: 'event-2' };

        cache.set(params1, data1);
        cache.set(params2, data2);

        // Check entries iterator
        const entries = Array.from(cache);
        expect(entries).toHaveLength(2);
        expect(entries).toContainEqual([ params1, data1 ]);
        expect(entries).toContainEqual([ params2, data2 ]);

        // Check entries() iterator explicitly
        const entriesIter = Array.from({ [Symbol.iterator]: () => cache.entries() });
        expect(entriesIter).toEqual(entries);

        // Check params iterator
        const params = Array.from({ [Symbol.iterator]: () => cache.params() });
        expect(params).toHaveLength(2);
        expect(params).toContainEqual(params1);
        expect(params).toContainEqual(params2);

        // Check values iterator
        const values = Array.from({ [Symbol.iterator]: () => cache.values() });
        expect(values).toHaveLength(2);
        expect(values).toContainEqual(data1);
        expect(values).toContainEqual(data2);
    });

    describe('TTL and expiration behaviour', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should respect TTL expiration times and prune automatically', () => {
            const cache = Cache.getInstance('TestCacheWithTTL');
            const params = { key: 'foo' };
            const data = 'some-value';

            cache.set(params, data);
            expect(cache.has(params)).toBeTruthy();
            expect(cache.get(params)).toEqual(data);

            // Advance timers by 5 seconds (not yet expired)
            vi.advanceTimersByTime(5000);
            expect(cache.has(params)).toBeTruthy();
            expect(cache.get(params)).toEqual(data);

            // Advance timers by another 5 seconds (total 10 seconds, should be expired)
            vi.advanceTimersByTime(5000);
            expect(cache.has(params)).toBeFalsy();
            expect(cache.get(params)).toBeUndefined();
        });

        it('should filter out expired items in iterators', () => {
            const cache = Cache.getInstance('TestCacheWithTTL');
            cache.set({ key: 'v1' }, 'data1');

            vi.advanceTimersByTime(5000);
            cache.set({ key: 'v2' }, 'data2');

            // Both should be in iterator
            let entries = Array.from(cache);
            expect(entries).toHaveLength(2);

            // Advance by another 6 seconds. v1 is at 11s (expired), v2 is at 6s (active).
            vi.advanceTimersByTime(6000);

            entries = Array.from(cache);
        });
    });

    describe('metadata()', () => {
        it('should track access count, last access time, and byte size', () => {
            const cache = Cache.getInstance('TestCacheWithParams');

            const params1 = { a: 1, b: 'foo' };
            const data1 = 'hello'; // 5 bytes in UTF-8
            const params2 = { a: 2, b: 'bar' };
            const data2 = 'world!'; // 6 bytes in UTF-8

            // Initially empty
            expect(Array.from(cache.metadata())).toHaveLength(0);

            // Add entries
            const beforeSet = performance.now();
            cache.set(params1, data1);
            cache.set(params2, data2);

            let metadata = Array.from(cache.metadata());
            expect(metadata).toHaveLength(2);

            // Sort metadata by byte size or find the specific ones
            const meta1 = metadata.find(m => m.bytes === 5)!;
            const meta2 = metadata.find(m => m.bytes === 6)!;

            expect(meta1).toBeDefined();
            expect(meta1.accessCount).toBe(1); // Set counts as initial access
            expect(meta1.lastAccessTime).toBeGreaterThanOrEqual(beforeSet);

            expect(meta2).toBeDefined();
            expect(meta2.accessCount).toBe(1);
            expect(meta2.lastAccessTime).toBeGreaterThanOrEqual(beforeSet);

            // Get data1 (cache hit, accessCount increments)
            const beforeGet = performance.now();
            cache.get(params1);

            metadata = Array.from(cache.metadata());
            const meta1Updated = metadata.find(m => m.bytes === 5)!;
            expect(meta1Updated.accessCount).toBe(2);
            expect(meta1Updated.lastAccessTime).toBeGreaterThanOrEqual(beforeGet);

            // Check getOrInsert hit
            const beforeGetOrInsert = performance.now();
            cache.getOrInsert(params2, async () => 'ignored');

            metadata = Array.from(cache.metadata());
            const meta2Updated = metadata.find(m => m.bytes === 6)!;
            expect(meta2Updated.accessCount).toBe(2);
            expect(meta2Updated.lastAccessTime).toBeGreaterThanOrEqual(beforeGetOrInsert);
        });

        it('should handle null and object contents correctly for byte size', async () => {
            const cache = Cache.getInstance('AdminNavigationActiveEvents');
            const params = { limit: 5 };
            const data = { concluded: false, label: 'Event 1', slug: 'event-1' };

            await cache.getOrInsert(params, async () => data);
            let metadata = Array.from(cache.metadata());
            expect(metadata).toHaveLength(1);
            expect(metadata[0].bytes).toBe(new TextEncoder().encode(JSON.stringify(data)).length);

            // Set to null
            cache.set(params, null as any);
            metadata = Array.from(cache.metadata());
            expect(metadata).toHaveLength(1);
            expect(metadata[0].bytes).toBe(0);
        });
    });
});
