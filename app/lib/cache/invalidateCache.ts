// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { CacheType } from './CacheDescriptors';
import type { InvalidationArgs, InvalidationScope, ResolvedInvalidationContext }
    from './InvalidationScopes';
import { Cache } from './Cache';
import { expandInvalidationScopes } from './InvalidationScopes';
import { invalidateNextCacheTags } from './nextCacheBridge';

import { kCacheDescriptor } from './CacheDescriptors';

/**
 * Resolves the missing half of an `{ eventId, eventSlug }` pair purely from in-memory caches
 * (`UrlSlugs` and `EventCache`) without issuing database queries.
 */
function resolveEventIdentity(eventId?: number, eventSlug?: string)
    : { eventId?: number; eventSlug?: string }
{
    let resolvedId = eventId;
    let resolvedSlug = eventSlug;

    if (resolvedId !== undefined && !resolvedSlug) {
        const slugCache = Cache.getInstance('UrlSlugs');
        resolvedSlug = slugCache.get({ event: resolvedId }) ?? undefined;

        if (!resolvedSlug) {
            for (const [ slug, cachedEvent ] of Cache.getInstance('EventCache').entries()) {
                if (cachedEvent?.id === resolvedId) {
                    resolvedSlug = slug;
                    break;
                }
            }
        }
    } else if (resolvedSlug && resolvedId === undefined) {
        const cachedEvent = Cache.getInstance('EventCache').get(resolvedSlug);
        if (cachedEvent) {
            resolvedId = cachedEvent.id;
        } else {
            for (const [ params, slug ] of Cache.getInstance('UrlSlugs').entries()) {
                if ('event' in params && slug === resolvedSlug) {
                    resolvedId = params.event;
                    break;
                }
            }
        }
    }

    return { eventId: resolvedId, eventSlug: resolvedSlug };
}

/**
 * Resolves the missing half of a `{ teamId, teamSlug }` pair purely from in-memory caches
 * (`UrlSlugs` and `TeamCache`) without issuing database queries.
 */
function resolveTeamIdentity(teamId?: number, teamSlug?: string)
    : { teamId?: number; teamSlug?: string }
{
    let resolvedId = teamId;
    let resolvedSlug = teamSlug;

    if (resolvedId !== undefined && !resolvedSlug) {
        const slugCache = Cache.getInstance('UrlSlugs');
        resolvedSlug = slugCache.get({ team: resolvedId }) ?? undefined;

        if (!resolvedSlug) {
            for (const [ slug, cachedTeam ] of Cache.getInstance('TeamCache').entries()) {
                if (cachedTeam?.id === resolvedId) {
                    resolvedSlug = slug;
                    break;
                }
            }
        }
    } else if (resolvedSlug && resolvedId === undefined) {
        const cachedTeam = Cache.getInstance('TeamCache').get(resolvedSlug);
        if (cachedTeam) {
            resolvedId = cachedTeam.id;
        } else {
            for (const [ params, slug ] of Cache.getInstance('UrlSlugs').entries()) {
                if ('team' in params && slug === resolvedSlug) {
                    resolvedId = params.team;
                    break;
                }
            }
        }
    }

    return { teamId: resolvedId, teamSlug: resolvedSlug };
}

/**
 * Normalizes raw caller parameters into a `ResolvedInvalidationContext` before any caches are
 * evicted so all handlers receive consistent IDs, slugs, and user ID lists.
 */
function buildResolvedContext(rawParams: Record<string, any> | undefined)
    : ResolvedInvalidationContext
{
    if (!rawParams)
        return {};

    const { eventId, eventSlug } = resolveEventIdentity(rawParams.eventId, rawParams.eventSlug);
    const { teamId, teamSlug } = resolveTeamIdentity(rawParams.teamId, rawParams.teamSlug);

    let userIds: readonly number[] | undefined;
    if (rawParams.userIds !== undefined)
        userIds = [ ...rawParams.userIds ];
    else if (rawParams.userId !== undefined)
        userIds = [ rawParams.userId ];

    return {
        accountId: rawParams.accountId,
        activityId: rawParams.activityId,
        areaId: rawParams.areaId,
        categoryId: rawParams.categoryId,
        contentCreated: rawParams.contentCreated,
        contentId: rawParams.contentId,
        contentType: rawParams.type,
        eventId,
        eventSlug,
        festivalId: rawParams.festivalId,
        keys: rawParams.keys,
        locationId: rawParams.locationId,
        previousSlug: rawParams.previousSlug,
        roleId: rawParams.roleId,
        shiftId: rawParams.shiftId,
        teamId,
        teamSlug,
        ticketTarget: rawParams.target,
        userId: rawParams.userId,
        userIds,
    };
}

/**
 * Invalidates all caches affected by the domain mutation described by `scope` and `params`.
 *
 * Scopes are expanded transitively through `kScopeImplications` (from most specific to least
 * specific). Each cache descriptor declaring a matching handler executes at most once, using its
 * most specific matching handler.
 */
export function invalidateCache<Scope extends InvalidationScope>(
    scope: Scope, ...args: InvalidationArgs<Scope>): void
{
    const context = buildResolvedContext(args[0] as Record<string, any> | undefined);
    const scopes = expandInvalidationScopes(scope);

    for (const cacheName of Object.keys(kCacheDescriptor) as CacheType[]) {
        const policy = kCacheDescriptor[cacheName].invalidation;
        if (typeof policy === 'string')
            continue;

        for (const activeScope of scopes) {
            const handler = policy[activeScope];
            if (!handler)
                continue;

            const cache = Cache.getInstance(cacheName);
            if (handler === 'clear')
                cache.clear();
            else
                handler(cache as any, context);

            break;
        }
    }

    invalidateNextCacheTags(scopes, context);
}
