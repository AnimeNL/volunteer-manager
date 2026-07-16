// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Contents of each of the caches known to the system.
 */
interface CacheDescriptorMap {
    // ---------------------------------------------------------------------------------------------
    // Web App Manifest
    // ---------------------------------------------------------------------------------------------

    ManifestLatestEvent: {
        Parameters: undefined;
        Contents: {
            name: string;
            fullName: string;
        };
    },

    // ---------------------------------------------------------------------------------------------
    // Administration > Dashboard
    // ---------------------------------------------------------------------------------------------

    AdminNavigationActiveEvents: {
        Parameters: undefined;
        Contents: {
            concluded: boolean;
            label: string;
            slug: string;
        }[];
    };

    // ---------------------------------------------------------------------------------------------
    // Caches used for test cases
    // ---------------------------------------------------------------------------------------------

    TestCacheWithParams: {
        Parameters: {
            a: number;
            b: string;
        };

        Contents: string;
    };

    TestCacheWithLRU: {
        Parameters: {
            key: string;
        };

        Contents: string;
    };

    TestCacheWithTTL: {
        Parameters: {
            key: string;
        };

        Contents: string;
    };

}

/**
 * Set of unique names of caches that are available in the system.
 */
export type CacheType = keyof CacheDescriptorMap;

/**
 * Acquire the parameters that are expected for a cached instance of `T`.
 */
export type CacheParameters<T extends CacheType> = CacheDescriptorMap[T]['Parameters'];

/**
 * Acquire the contents that are expected for a cached instance of `T`.
 */
export type CacheContents<T extends CacheType> = CacheDescriptorMap[T]['Contents'];

/**
 * Descriptor indicating the information that must be known for each type of cache.
 */
export type CacheDescriptor<T extends CacheType> = {
    /**
     * Name of the cache.
     */
    name: T;

    /**
     * Whether this is an internal cache, which should not be considered by `getAll()`.
     */
    internal?: true;

} & (
    {
        /**
         * Permanent cache: stays in memory until manually cleared.
         */
        type: 'permanent';
    } |
    {
        /**
         * Time-to-live cache: entries expire after `ttl` seconds.
         */
        type: 'ttl';

        /**
         * Number of seconds entries should expire after.
         */
        ttl: number;
    } |
    {
        /**
         * Least-recently-used cache: entries are capped at `maxSize`.
         */
        type: 'lru';

        /**
         * Number of entries that may exist in the cache.
         */
        maxSize: number;
    }
);

/**
 * Descriptors of the caches that exist in the system.
 */
export const kCacheDescriptor: { [k in CacheType]: CacheDescriptor<k> } = {
    // ---------------------------------------------------------------------------------------------
    // Web App Manifest
    // ---------------------------------------------------------------------------------------------

    ManifestLatestEvent: {
        name: 'ManifestLatestEvent',
        type: 'permanent',
    },

    // ---------------------------------------------------------------------------------------------
    // Administration > Dashboard
    // ---------------------------------------------------------------------------------------------

    AdminNavigationActiveEvents: {
        name: 'AdminNavigationActiveEvents',
        type: 'permanent',
    },

    // ---------------------------------------------------------------------------------------------
    // Caches used for test cases
    // ---------------------------------------------------------------------------------------------

    TestCacheWithParams: {
        internal: true,
        name: 'TestCacheWithParams',
        type: 'permanent',
    },

    TestCacheWithLRU: {
        internal: true,
        name: 'TestCacheWithLRU',
        type: 'lru',
        maxSize: 3,
    },

    TestCacheWithTTL: {
        internal: true,
        name: 'TestCacheWithTTL',
        type: 'ttl',
        ttl: 10,
    },

};
