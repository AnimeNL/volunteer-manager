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
        Parameters: {
            limit: number;
        };

        Contents: {
            concluded: boolean;
            label: string;
            slug: string;
        };
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
export interface CacheDescriptor<T extends CacheType> {
    /**
     * Name of the cache.
     */
    name: T;

    /**
     * Expiration time for an individually cached item, in seconds. "0" means no expiration.
     */
    ttl: number;
};

/**
 * Descriptors of the caches that exist in the system.
 */
export const kCacheDescriptor: { [k in CacheType]: CacheDescriptor<k> } = {
    // ---------------------------------------------------------------------------------------------
    // Web App Manifest
    // ---------------------------------------------------------------------------------------------

    ManifestLatestEvent: {
        name: 'ManifestLatestEvent',
        ttl: 0,
    },

    // ---------------------------------------------------------------------------------------------
    // Administration > Dashboard
    // ---------------------------------------------------------------------------------------------

    AdminNavigationActiveEvents: {
        name: 'AdminNavigationActiveEvents',
        ttl: 0,
    },

    // ---------------------------------------------------------------------------------------------
    // Caches used for test cases
    // ---------------------------------------------------------------------------------------------

    TestCacheWithParams: {
        name: 'TestCacheWithParams',
        ttl: 0,
    },

    TestCacheWithTTL: {
        name: 'TestCacheWithTTL',
        ttl: 10,
    },

};
