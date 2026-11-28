// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { PaletteMode } from '@mui/material/styles';

import type { CachedEvent, CachedTeam, CachedVendorShift } from './Types';
import type { EnvironmentPurpose } from '../database/Types';
import type { EventStateCacheEntry } from '@lib/event/EventStateCacheEntry';
import type { InvalidationScope, ResolvedInvalidationContext } from './InvalidationScopes';
import type { UserAuthenticationContext } from '@lib/auth';

/**
 * Contents of each of the caches known to the system.
 */
interface CacheDescriptorMap {
    // ---------------------------------------------------------------------------------------------
    // Shared caches
    // ---------------------------------------------------------------------------------------------

    Authentication: {
        Parameters: number;  // user ID
        Contents: {
            context: UserAuthenticationContext;
            sessions: Map<number, string>;  // sessionId -> SHA-256 hash of secret
        };
    };

    Blob: {
        Parameters: string;
        Contents: {
            bytes: Uint8Array<ArrayBuffer>;
            mimeType: string;
        };
    },

    Content: {
        Parameters: {
            environment: string;
            eventId: number;
            path: string;
        };
        Contents: {
            title: string;
            content: string;
        };
    };

    ContentMarkdown: {
        Parameters: string;
        Contents: any;  // unified / remark / rehype output
    };

    Environments: {
        Parameters: undefined;
        Contents: {
            id: number;
            colours: { [key in PaletteMode]: string };
            description: string;
            domain: `${string}.${string}`;
            purpose: EnvironmentPurpose;
            teams: string[];
            title: string;
        }[];
    };

    EventCache: {
        Parameters: string;  // event slug
        Contents: CachedEvent;
    };

    EventState: {
        Parameters: number;  // event ID
        Contents: EventStateCacheEntry;
    };

    IP2Location: {
        Parameters: string;
        Contents: {
            country_code?: string;
            country_name?: string;
            region_name?: string;
            city_name?: string;
            latitude?: number;
            longitude?: number;
            zip_code?: string;
            time_zone?: string;
        };
    };

    ManifestLatestEvent: {
        Parameters: undefined;
        Contents: {
            name: string;
            fullName: string;
        };
    },

    PageMetadata: {
        Parameters: {
            type: string;
            id: string;
        };
        Contents: string;
    };

    PermissionRoles: {
        Parameters: string;
        Contents: {
            grants: string[];
            revokes: string[];
        };
    },

    Settings: {
        Parameters: string;
        Contents: { value: unknown };  // any JSON-serialisable value
    },

    TeamCache: {
        Parameters: string;  // team slug
        Contents: CachedTeam;
    };

    UrlSlugs: {
        Parameters: { event: number } | { team: number };
        Contents: string;
    };

    UserSettings: {
        Parameters: number;  // user ID
        Contents: Record<string, any>;
    };

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

    AdminNavigationMenuCache: {
        Parameters: string;
        Contents: any;  // menu-specific
    };

    // ---------------------------------------------------------------------------------------------
    // Administration > Events
    // ---------------------------------------------------------------------------------------------

    EventFinances: {
        Parameters: string;
        Contents: any;  // FinanceProcessor
    };

    // ---------------------------------------------------------------------------------------------
    // Administration > Events > Tickets
    // ---------------------------------------------------------------------------------------------

    TicketProvider: {
        Parameters: string;
        Contents: {
            events?: { id: string; label: string }[];
            order?: { email?: string };
            scanners?: { id: string; label: string }[];
            shops?: { id: string; label: string }[];
            ticketTypes?: { id: string; label: string }[];
        };
    };

    // ---------------------------------------------------------------------------------------------
    // Volunteer Portal
    // ---------------------------------------------------------------------------------------------

    VolunteerPortal: {
        Parameters: {
            eventId: number;
            type: 'vendors';
        };
        Contents: CachedVendorShift[];
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

    TestCacheWithBoundedTTL: {
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
 * Minimal structural subset of `Cache<T>` passed to descriptor invalidation handlers, avoiding a
 * circular dependency between `CacheDescriptors.ts` and `Cache.ts`.
 */
interface CacheInvalidationHandle<T extends CacheType> {
    clear(): void;
    delete(
        ...args: [CacheParameters<T>] extends [undefined]
            ? []
            : [ params: Partial<CacheParameters<T>> ]
    ): void;
    entries(): IterableIterator<[ CacheParameters<T>, CacheContents<T> | null ]>;
    get(
        ...args: [CacheParameters<T>] extends [undefined]
            ? []
            : [ params: CacheParameters<T> ]
    ): CacheContents<T> | null | undefined;
    params(): IterableIterator<CacheParameters<T>>;
}

/**
 * Explicit opt-out strategy for caches that do not participate in scope-driven invalidation.
 */
export type CacheInvalidationStrategy =
    | 'content-addressed'
    | 'manual'
    | 'ttl-only'
    | 'write-through';

/**
 * Per-scope reaction declared on a cache descriptor. Using `'clear'` evicts the entire cache; a
 * handler function performs targeted eviction or dirty-marking. When multiple scopes in an
 * implication chain match the same cache, only the most specific matching handler runs.
 */
export type CacheInvalidationHandler<T extends CacheType> =
    | 'clear'
    | ((cache: CacheInvalidationHandle<T>, context: ResolvedInvalidationContext) => void);

/**
 * Invalidation policy required on every cache descriptor.
 */
export type CacheInvalidationPolicy<T extends CacheType> =
    | CacheInvalidationStrategy
    | Partial<Record<InvalidationScope, CacheInvalidationHandler<T>>>;

/**
 * Descriptor indicating the information that must be known for each type of cache.
 */
export type CacheDescriptor<T extends CacheType> = {
    /**
     * Name of the cache.
     */
    name: T;

    /**
     * Description that explains why this cache exists.
     */
    description: string;

    /**
     * How this cache is invalidated in response to domain mutations.
     */
    invalidation: CacheInvalidationPolicy<T>;

    /**
     * Optional link template to provide click-through functionality in the UI.
     */
    linkTemplate?: string;

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
         * Time-to-live cache: entries expire after `ttl` seconds, and may optionally enforce an
         * LRU `maxSize` cap to bound memory usage.
         */
        type: 'ttl';

        /**
         * Number of seconds entries should expire after.
         */
        ttl: number;

        /**
         * Optional maximum number of entries retained in the cache (LRU eviction when exceeded).
         */
        maxSize?: number;
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
 * System settings that affect `EventState` availability timeline boundaries.
 */
const kEventStateBoundarySettings = new Set([
    'schedule-event-view-start-hours',
    'schedule-event-view-end-hours',
]);

/**
 * Descriptors of the caches that exist in the system.
 */
export const kCacheDescriptor: { [k in CacheType]: CacheDescriptor<k> } = {
    // ---------------------------------------------------------------------------------------------
    // Shared caches
    // ---------------------------------------------------------------------------------------------

    Authentication: {
        name: 'Authentication',
        description: 'Authenticated user sessions and resolved access control contexts.',
        type: 'ttl',
        ttl: 900,  // 15 minutes
        maxSize: 1000,
        invalidation: {
            'event.visibility': 'clear',
            'permissionRole': 'clear',
            'role': 'clear',
            'team.visibility': 'clear',
            'user.auth': (cache, { userIds }) => {
                if (!userIds)
                    return;

                for (const userId of userIds)
                    cache.delete(userId);
            },
        },
    },

    Blob: {
        name: 'Blob',
        description: 'LRU cache of binary data retrieved from the database.',
        linkTemplate: '/blob/{params}.png',
        type: 'lru',
        maxSize: 100,
        invalidation: 'content-addressed',
    },

    Content: {
        name: 'Content',
        description: 'Content and knowledge base articles published across the system.',
        type: 'permanent',
        invalidation: {
            'event.content': (cache, { eventId }) => {
                if (eventId !== undefined)
                    cache.delete({ eventId });
            },
            'event.teams': (cache, { contentCreated, eventId }) => {
                if (contentCreated && eventId !== undefined)
                    cache.delete({ eventId });
            },
        },
    },

    ContentMarkdown: {
        name: 'ContentMarkdown',
        description: 'Compiled React element representation of Markdown content.',
        type: 'ttl',  // there is a lot of dynamic content
        ttl: 3600,
        invalidation: 'content-addressed',
    },

    Environments: {
        name: 'Environments',
        description: 'Environments (i.e. tenants) on the Volunteer Manager.',
        type: 'permanent',
        invalidation: {
            'environment': 'clear',
            'team': 'clear',
        },
    },

    EventCache: {
        name: 'EventCache',
        description: 'Contextual event information used throughout the system.',
        type: 'permanent',
        invalidation: {
            'event': (cache, { eventSlug, previousSlug }) => {
                if (eventSlug)
                    cache.delete(eventSlug);
                if (previousSlug)
                    cache.delete(previousSlug);
            },
        },
    },

    EventState: {
        name: 'EventState',
        description: 'Indexed operational event state (program, volunteers, shifts, and schedules).',
        type: 'permanent',
        invalidation: {
            'event': (cache, { eventId }) => {
                if (eventId !== undefined)
                    cache.delete(eventId);
            },
            'event.program': (cache, { festivalId }) => {
                if (festivalId === undefined)
                    return;

                for (const [ , entry ] of cache.entries()) {
                    if (entry && entry.festivalId === festivalId)
                        entry.markDirty('program');
                }
            },
            'event.schedule': (cache, { eventId }) => {
                if (eventId !== undefined)
                    cache.get(eventId)?.markDirty('schedule');
            },
            'event.shifts': (cache, { eventId }) => {
                if (eventId !== undefined)
                    cache.get(eventId)?.markDirty('shifts');
            },
            'event.teams': (cache, { eventId }) => {
                if (eventId !== undefined)
                    cache.get(eventId)?.markDirty('teams');
            },
            'event.volunteer': (cache, { eventId, userId }) => {
                if (eventId !== undefined && userId !== undefined)
                    cache.get(eventId)?.markVolunteerDirty(userId);
            },
            'role': (cache) => {
                for (const [ , entry ] of cache.entries())
                    entry?.markDirty('teams');
            },
            'settings': (cache, { keys }) => {
                if (!keys?.some(key => kEventStateBoundarySettings.has(key)))
                    return;

                for (const [ , entry ] of cache.entries())
                    entry?.resetBoundaryHours();
            },
            'shiftCategories': (cache) => {
                for (const [ , entry ] of cache.entries())
                    entry?.markDirty('shifts');
            },
            'team': (cache) => {
                for (const [ , entry ] of cache.entries())
                    entry?.markDirty('teams');
            },
        },
    },

    IP2Location: {
        name: 'IP2Location',
        description: 'IP-to-location lookups used for diagnostics and investigation.',
        type: 'ttl',
        ttl: 86400,  // one day
        invalidation: 'ttl-only',
    },

    ManifestLatestEvent: {
        name: 'ManifestLatestEvent',
        description: 'Latest visible event for use in manifest.json.',
        type: 'permanent',
        invalidation: 'manual',
    },

    PageMetadata: {
        name: 'PageMetadata',
        description: 'Resolved entity labels displayed in administration page titles.',
        type: 'ttl',
        ttl: 900,
        invalidation: {
            'environment': (cache) => {
                cache.delete({ type: 'environment' });
            },
            'inbox': (cache, { accountId }) => {
                if (accountId !== undefined)
                    cache.delete({ type: 'emailAccount', id: String(accountId) });
            },
            'permissionRole': (cache, { roleId }) => {
                if (roleId)
                    cache.delete({ type: 'role', id: roleId });
            },
            'user.profile': (cache) => {
                cache.delete({ type: 'user' });
            },
        },
    },

    PermissionRoles: {
        name: 'PermissionRoles',
        description: 'Roles that can be assigned to users granting them certain permissions',
        type: 'permanent',
        invalidation: 'write-through',
    },

    Settings: {
        name: 'Settings',
        description: 'Server-side configuration settings.',
        type: 'permanent',
        invalidation: 'write-through',
    },

    TeamCache: {
        name: 'TeamCache',
        description: 'Contextual team information used throughout the system.',
        type: 'permanent',
        invalidation: {
            'team': (cache, { teamSlug }) => {
                if (teamSlug)
                    cache.delete(teamSlug);
            },
        },
    },

    UrlSlugs: {
        name: 'UrlSlugs',
        description: 'URL-safe slugs to both event and team unique IDs.',
        type: 'permanent',
        invalidation: {
            'event': (cache, { eventId }) => {
                if (eventId !== undefined)
                    cache.delete({ event: eventId });
            },
            'team': (cache, { teamId }) => {
                if (teamId !== undefined)
                    cache.delete({ team: teamId });
            },
        },
    },

    UserSettings: {
        name: 'UserSettings',
        description: 'User-specific server-side configuration settings.',
        type: 'permanent',
        invalidation: 'write-through',
    },

    // ---------------------------------------------------------------------------------------------
    // Administration > Dashboard
    // ---------------------------------------------------------------------------------------------

    AdminNavigationActiveEvents: {
        name: 'AdminNavigationActiveEvents',
        description: 'Active events for use in the admin navigation.',
        type: 'ttl',
        ttl: 300,
        invalidation: {
            'event.identity': 'clear',
            'event.teams': 'clear',
        },
    },

    AdminNavigationMenuCache: {
        name: 'AdminNavigationMenuCache',
        description: 'Badges and counters displayed in the administration navigation.',
        type: 'ttl',
        ttl: 300,
        invalidation: {
            'event.slug': 'clear',
            'event.teams': (cache, { eventSlug }) => {
                if (eventSlug)
                    cache.delete(eventSlug);
            },
            'inbox': (cache, { userId }) => {
                if (userId !== undefined) {
                    cache.delete(`inbox/${userId}`);
                    return;
                }

                for (const key of [ ...cache.params() ]) {
                    if (key.startsWith('inbox/'))
                        cache.delete(key);
                }
            },
            'team': 'clear',
        },
    },

    // ---------------------------------------------------------------------------------------------
    // Administration > Events
    // ---------------------------------------------------------------------------------------------

    EventFinances: {
        name: 'EventFinances',
        description: 'Processed financial information associated with an event.',
        type: 'permanent',
        invalidation: 'manual',
    },

    // ---------------------------------------------------------------------------------------------
    // Administration > Events > Tickets
    // ---------------------------------------------------------------------------------------------

    TicketProvider: {
        name: 'TicketProvider',
        description: 'Options and order details retrieved from ticketing providers.',
        type: 'ttl',
        ttl: 72 * 3600,
        invalidation: {
            'event.tickets': (cache, { eventSlug, ticketTarget }) => {
                if (!eventSlug)
                    return;

                if (ticketTarget === 'weeztix')
                    cache.delete(`${eventSlug}/weeztix`);

                cache.delete(`${eventSlug}/weeztix/ticketTypes`);
            },
        },
    },

    // ---------------------------------------------------------------------------------------------
    // Volunteer Portal
    // ---------------------------------------------------------------------------------------------

    VolunteerPortal: {
        name: 'VolunteerPortal',
        description: 'Event-scoped data cached for the volunteer schedule portal.',
        type: 'permanent',
        invalidation: {
            'event.vendors': (cache, { eventId }) => {
                if (eventId !== undefined)
                    cache.delete({ eventId, type: 'vendors' });
            },
        },
    },

    // ---------------------------------------------------------------------------------------------
    // Caches used for test cases
    // ---------------------------------------------------------------------------------------------

    TestCacheWithParams: {
        internal: true,
        name: 'TestCacheWithParams',
        description: 'Internal cache used for testing',
        type: 'permanent',
        invalidation: 'manual',
    },

    TestCacheWithLRU: {
        internal: true,
        name: 'TestCacheWithLRU',
        description: 'Internal cache used for testing',
        type: 'lru',
        maxSize: 3,
        invalidation: 'manual',
    },

    TestCacheWithTTL: {
        internal: true,
        name: 'TestCacheWithTTL',
        description: 'Internal cache used for testing',
        type: 'ttl',
        ttl: 10,
        invalidation: 'manual',
    },

    TestCacheWithBoundedTTL: {
        internal: true,
        name: 'TestCacheWithBoundedTTL',
        description: 'Internal cache used for testing',
        type: 'ttl',
        ttl: 10,
        maxSize: 2,
        invalidation: 'manual',
    },

};
