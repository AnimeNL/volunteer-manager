// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Cache } from './Cache';
import { kCacheDescriptor } from './CacheDescriptors';

describe('Cache', () => {
    beforeEach(() => {
        // Clear all entries from the shared storage before each test
        const cache = Cache.get('ManifestLatestEvent');
        cache.clear();
        const adminCache = Cache.get('AdminNavigationActiveEvents');
        adminCache.clear();

        // Clear any dynamic test caches if registered
        if (Object.hasOwn(kCacheDescriptor, 'TestCacheWithTTL')) {
            const ttlCache = Cache.get('TestCacheWithTTL' as any);
            ttlCache.clear();
        }
        if (Object.hasOwn(kCacheDescriptor, 'TestCacheWithParams')) {
            const paramsCache = Cache.get('TestCacheWithParams' as any);
            paramsCache.clear();
        }
    });

    it('should throw for unknown cache types', () => {
        expect(() => Cache.get('InvalidType' as any))
            .toThrow('Unknown cache type given: InvalidType');
    });

    it('should share underlying storage between instances of the same cache type', () => {
        const cache1 = Cache.get('ManifestLatestEvent');
        const cache2 = Cache.get('ManifestLatestEvent');
        const cache3 = Cache.get('AdminNavigationActiveEvents');

        // Set on cache1, should be visible on cache2 but not cache3
        const manifestData = { name: 'AnimeCon 2026', fullName: 'AnimeCon 2026 Event' };
        // @ts-expect-error: ManifestLatestEvent has parameters of type never, but let's test storing/retrieving it
        cache1.set(undefined, manifestData);

        // @ts-expect-error
        expect(cache2.has(undefined)).toBeTruthy();
        // @ts-expect-error
        expect(cache2.get(undefined)).toEqual(manifestData);

        expect(cache3.has({ limit: 10 })).toBeFalsy();
    });

    it('should support basic get, set, has, and clear operations', () => {
        const cache = Cache.get('AdminNavigationActiveEvents');

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
        const cache = Cache.get('AdminNavigationActiveEvents');
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
        // @ts-expect-error: Add test cache descriptor with custom parameters for testing delete and matching
        kCacheDescriptor['TestCacheWithParams'] = {
            name: 'TestCacheWithParams',
            ttl: 0,
        };

        const cache = Cache.get('TestCacheWithParams' as any);

        const entry1 = { a: 1, b: 'foo' };
        const entry2 = { a: 1, b: 'bar' };
        const entry3 = { a: 2, b: 'foo' };

        cache.set(entry1 as any, 'data1' as any);
        cache.set(entry2 as any, 'data2' as any);
        cache.set(entry3 as any, 'data3' as any);

        // Delete with partial match { a: 1 } should delete entry1 and entry2 but keep entry3
        cache.delete({ a: 1 } as any);
        expect(cache.has(entry1 as any)).toBeFalsy();
        expect(cache.has(entry2 as any)).toBeFalsy();
        expect(cache.has(entry3 as any)).toBeTruthy();

        // Delete with partial match { b: 'foo' } should delete entry3
        cache.delete({ b: 'foo' } as any);
        expect(cache.has(entry3 as any)).toBeFalsy();
    });

    it('should support iterating over entries, values, and params', () => {
        const cache = Cache.get('AdminNavigationActiveEvents');

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
            // @ts-expect-error: Add a test cache descriptor to verify TTL logic
            kCacheDescriptor['TestCacheWithTTL'] = {
                name: 'TestCacheWithTTL',
                ttl: 10, // 10 seconds
            };

            const cache = Cache.get('TestCacheWithTTL' as any);
            const params = { key: 'foo' };
            const data = 'some-value';

            cache.set(params as any, data as any);
            expect(cache.has(params as any)).toBeTruthy();
            expect(cache.get(params as any)).toEqual(data);

            // Advance timers by 5 seconds (not yet expired)
            vi.advanceTimersByTime(5000);
            expect(cache.has(params as any)).toBeTruthy();
            expect(cache.get(params as any)).toEqual(data);

            // Advance timers by another 5 seconds (total 10 seconds, should be expired)
            vi.advanceTimersByTime(5000);
            expect(cache.has(params as any)).toBeFalsy();
            expect(cache.get(params as any)).toBeUndefined();
        });

        it('should filter out expired items in iterators', () => {
            // @ts-expect-error: Add a test cache descriptor to verify TTL logic
            kCacheDescriptor['TestCacheWithTTL'] = {
                name: 'TestCacheWithTTL',
                ttl: 10, // 10 seconds
            };

            const cache = Cache.get('TestCacheWithTTL' as any);
            cache.set({ k: 'v1' } as any, 'data1' as any);

            vi.advanceTimersByTime(5000);
            cache.set({ k: 'v2' } as any, 'data2' as any);

            // Both should be in iterator
            let entries = Array.from(cache);
            expect(entries).toHaveLength(2);

            // Advance by another 6 seconds. v1 is at 11s (expired), v2 is at 6s (active).
            vi.advanceTimersByTime(6000);

            entries = Array.from(cache);
            expect(entries).toHaveLength(1);
            expect(entries[0]).toEqual([ { k: 'v2' }, 'data2' ]);
        });
    });
});
