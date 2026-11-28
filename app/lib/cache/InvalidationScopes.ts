// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { ContentType } from '@lib/database/Types';

/**
 * Identifier accepted by event-scoped invalidations. Callers may pass an event ID, a slug, or both;
 * `invalidateCache()` resolves the missing half up front before evicting any caches.
 */
type EventIdentifier =
    | { readonly eventId: number; readonly eventSlug?: string }
    | { readonly eventId?: number; readonly eventSlug: string };

/**
 * Identifier accepted by team-scoped invalidations. Callers may pass a team ID, a slug, or both;
 * `invalidateCache()` resolves the missing half up front before evicting any caches.
 */
type TeamIdentifier =
    | { readonly teamId: number; readonly teamSlug?: string }
    | { readonly teamId?: number; readonly teamSlug: string };

/**
 * Payload accepted by each domain invalidation scope.
 */
export interface InvalidationScopeMap {
    /**
     * An environment was created, updated, or deleted.
     */
    'environment': undefined;

    /**
     * General event settings changed (e.g. features, integrations, cover image, ticketing config).
     */
    'event': EventIdentifier;

    /**
     * Content or knowledge base articles/categories for an event (or `eventId: 0` global) changed.
     */
    'event.content': {
        readonly eventId: number;
        readonly type?: ContentType;
        readonly contentId?: number;
        readonly categoryId?: number;
    };

    /**
     * Event identity metadata changed (created, renamed, or dates updated). Implies `event`.
     */
    'event.identity': EventIdentifier;

    /**
     * AnPlan program data (areas, locations, activities, or timeslots) changed for a festival.
     */
    'event.program': {
        readonly festivalId: number;
        readonly areaId?: number;
        readonly locationId?: number;
        readonly activityId?: number;
    };

    /**
     * Shift schedule assignments for an event changed.
     */
    'event.schedule': {
        readonly eventId: number;
    };

    /**
     * Shifts belonging to an event were created, updated, or deleted.
     */
    'event.shifts': {
        readonly eventId: number;
        readonly shiftId?: number;
    };

    /**
     * An event's URL slug changed. Implies `event.visibility` -> `event.identity` -> `event`.
     */
    'event.slug': EventIdentifier & {
        readonly previousSlug: string;
    };

    /**
     * Participating teams (or their default content pages) for an event changed.
     */
    'event.teams': EventIdentifier & {
        readonly contentCreated?: boolean;
    };

    /**
     * Cached ticket provider options for an event should be refreshed.
     */
    'event.tickets': {
        readonly eventSlug: string;
        readonly target: 'weeztix' | 'weeztixTicketTypes';
    };

    /**
     * Vendor roster or shift schedule for an event changed.
     */
    'event.vendors': {
        readonly eventId: number;
    };

    /**
     * An event was published or unpublished. Implies `event.identity` -> `event`.
     */
    'event.visibility': EventIdentifier;

    /**
     * A volunteer's event-scoped details (preferences or notes) changed without affecting auth.
     */
    'event.volunteer': {
        readonly eventId: number;
        readonly userId: number;
    };

    /**
     * A volunteer's event participation status, team, or role changed. Implies `event.volunteer`
     * and `user.auth`.
     */
    'event.volunteer.membership': {
        readonly eventId: number;
        readonly userId: number;
    };

    /**
     * Inbox accounts, permissions, or thread state changed.
     */
    'inbox': {
        readonly accountId?: number;
        readonly userId?: number;
    } | undefined;

    /**
     * A permission role was created, updated, or deleted.
     */
    'permissionRole': {
        readonly roleId?: string;
    } | undefined;

    /**
     * Volunteer role definitions changed.
     */
    'role': undefined;

    /**
     * Server-side system settings changed.
     */
    'settings': {
        readonly keys: readonly string[];
    };

    /**
     * Global shift category definitions changed.
     */
    'shiftCategories': undefined;

    /**
     * A team was created or updated.
     */
    'team': TeamIdentifier;

    /**
     * A team was enabled or disabled. Implies `team`.
     */
    'team.visibility': TeamIdentifier;

    /**
     * User authentication, session, activation, or permission state changed.
     */
    'user.auth': { readonly userId: number } | { readonly userIds: Iterable<number> };

    /**
     * User profile details (name, avatar, contact info, or anonymization) changed. Implies
     * `user.auth`.
     */
    'user.profile': {
        readonly userId: number;
    };
}

/**
 * Union of all known cache invalidation scopes.
 */
export type InvalidationScope = keyof InvalidationScopeMap;

/**
 * Tuple of arguments expected by `invalidateCache()` for a given `Scope`.
 */
export type InvalidationArgs<Scope extends InvalidationScope> =
    undefined extends InvalidationScopeMap[Scope]
        ? [ params?: Exclude<InvalidationScopeMap[Scope], undefined> ]
        : [ params: InvalidationScopeMap[Scope] ];

/**
 * Normalized payload passed to cache invalidation handlers after up-front identity resolution.
 * Event and team scopes receive both ID and slug when resolvable, and user-bearing scopes always
 * expose a normalized `userIds` list.
 */
export interface ResolvedInvalidationContext {
    readonly accountId?: number;
    readonly activityId?: number;
    readonly areaId?: number;
    readonly categoryId?: number;
    readonly contentCreated?: boolean;
    readonly contentId?: number;
    readonly contentType?: ContentType;
    readonly eventId?: number;
    readonly eventSlug?: string;
    readonly festivalId?: number;
    readonly keys?: readonly string[];
    readonly locationId?: number;
    readonly previousSlug?: string;
    readonly roleId?: string;
    readonly shiftId?: number;
    readonly teamId?: number;
    readonly teamSlug?: string;
    readonly ticketTarget?: 'weeztix' | 'weeztixTicketTypes';
    readonly userId?: number;
    readonly userIds?: readonly number[];
}

/**
 * Shared escalation rules between invalidation scopes. When a scope is invalidated, all scopes
 * reachable through `kScopeImplications` are triggered automatically so individual cache
 * descriptors do not repeat severity conditionals.
 */
export const kScopeImplications: Partial<Record<InvalidationScope, readonly InvalidationScope[]>> =
{
    'event.slug': [ 'event.visibility' ],
    'event.visibility': [ 'event.identity' ],
    'event.identity': [ 'event' ],
    'event.volunteer.membership': [ 'event.volunteer', 'user.auth' ],
    'team.visibility': [ 'team' ],
    'user.profile': [ 'user.auth' ],
};

/**
 * Expands `scope` transitively through `kScopeImplications`, returning each affected scope once
 * in breadth-first order starting with `scope` itself.
 */
export function expandInvalidationScopes(scope: InvalidationScope): readonly InvalidationScope[] {
    const visited = new Set<InvalidationScope>([ scope ]);
    const queue: InvalidationScope[] = [ scope ];

    while (queue.length > 0) {
        const current = queue.shift()!;
        const implied = kScopeImplications[current];
        if (!implied)
            continue;

        for (const next of implied) {
            if (!visited.has(next)) {
                visited.add(next);
                queue.push(next);
            }
        }
    }

    return [ ...visited ];
}
