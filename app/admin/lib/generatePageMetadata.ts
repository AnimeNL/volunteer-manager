// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import { Cache, getEvent, getTeam } from '@lib/cache';
import { getAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tEmailAccounts, tEnvironments, tUsers } from '@lib/database';

import { kAnyEvent, kAnyTeam } from '@lib/auth/AccessList';

/**
 * Type that defines the resolver for an entity label, orthogonal to its data source.
 */
type EntityResolver = (value: string) => Promise<string | null>;

/**
 * Name of the product. Will be the last component in every page's title.
 */
const kProductName = 'AnimeCon Volunteer Manager';

/**
 * Resolvers that obtain a human-readable entity label when required for metadata generation.
 */
const kEntityResolvers = {
    emailAccount: async (value: string) => {
        const accountId = parseInt(value, /* radix= */ 10);
        if (!Number.isSafeInteger(accountId))
            return null;

        return await db.selectFrom(tEmailAccounts)
            .where(tEmailAccounts.emailAccountId.equals(accountId))
                .and(tEmailAccounts.emailAccountDeleted.isNull())
            .selectOneColumn(tEmailAccounts.emailAccountAddress)
            .executeSelectNoneOrOne();
    },

    environment: async (value: string) => {
        return await db.selectFrom(tEnvironments)
            .where(tEnvironments.environmentDomain.equals(value))
                .and(tEnvironments.environmentDeleted.isNull())
            .selectOneColumn(tEnvironments.environmentTitle)
            .executeSelectNoneOrOne();
    },

    user: async (value: string) => {
        const userId = parseInt(value, /* radix= */ 10);
        if (!Number.isSafeInteger(userId))
            return null;

        return await db.selectFrom(tUsers)
            .where(tUsers.userId.equals(userId))
            .selectOneColumn(tUsers.name)
            .executeSelectNoneOrOne();
    },
} satisfies Record<string, EntityResolver>;

/**
 * Set of entity types supported by `kEntityResolvers`.
 */
type EntityType = keyof typeof kEntityResolvers;

/**
 * Union of single-key parameter descriptors for each supported `EntityType`.
 */
type EntityPathValue = {
    [K in EntityType]: { [P in K]: string };
}[EntityType];

/**
 * Value of a path component in the title that will be generated. Strings are included as-is,
 * whereas special value types are keyed by the type of value (e.g. a user account), and valued by
 * the name of the parameter that indicates the relevant unique ID.
 *
 * Special value types are:
 *
 *   { emailAccount } - the parameter must include the e-mail account ID
 *   { environment } - the parameter must include the environment's domain
 *   { event } - the parameter must include the event's URL-safe slug
 *   { param } - the literal value of the given parameter
 *   { team } - the parameter must include the team's URL-safe slug
 *   { user } - the parameter must include the user ID
 */
type PathValue =
    string | EntityPathValue | { event: string } | { team: string } |
    { param: string, prefix?: string, suffix?: string };

/**
 * Creates a generateMetadata() function compatible with Next.js based on the given `path`. The path
 * will automatically be resolved against the parameters received from the Next.js router. Name of
 * the product does not have to be appended, that will happen automatically.
 *
 * The `path` should be included in natural order. For example, when you want the page title to end
 * up being "Settings | John Doe | Area | AnimeCon Volunteer Manager", then this function should
 * be called as such, considering that the product name will be appended automatically:
 *
 *   createGenerateMetadataFn('Settings', { user: 'id' }, 'Area');
 */
export function createGenerateMetadataFn(...path: PathValue[]) {
    return (props: PageProps<any>) => generateMetadata(props, path);
}

/**
 * Composes the metadata for the current page by completing the `path` with the given `props`.
 * Values loaded through `kEntityResolvers` are cached in the `PageMetadata` TTL cache.
 */
async function generateMetadata(props: PageProps<any>, path: PathValue[]): Promise<Metadata> {
    let lazyParamsInitialised: boolean = false;
    let lazyParams!: Awaited<typeof props['params']>;

    const metadataCache = Cache.getInstance('PageMetadata');

    const resolvedPath = [];
    for (const component of path) {
        if (typeof component === 'string') {
            resolvedPath.push(component);
            continue;
        }

        if (!lazyParamsInitialised) {
            const context = await getAuthenticationContext();
            const hasAdminAccess = context.access.can('event.visible', {
                event: kAnyEvent,
                team: kAnyTeam,
            });

            if (!context.user || !hasAdminAccess)
                return { title: kProductName };

            lazyParamsInitialised = true;
            lazyParams = await props.params;
        }

        if ('event' in component) {
            const event = await getEvent(lazyParams[component.event]);
            resolvedPath.push(event?.shortName || '{event}');
            continue;
        }

        if ('param' in component) {
            const value = lazyParams[component.param] || `{${component.param}}`;
            resolvedPath.push(`${component.prefix || ''}${value}${component.suffix || ''}`);
            continue;
        }

        if ('team' in component) {
            const team = await getTeam(lazyParams[component.team]);
            resolvedPath.push(team?.name || '{team}');
            continue;
        }

        for (const [ key, resolver ] of Object.entries(kEntityResolvers)) {
            const typedKey = key as EntityType;
            if (!(typedKey in component))
                continue;

            const paramName = (component as Record<EntityType, string>)[typedKey];
            if (!Object.hasOwn(lazyParams, paramName))
                throw new Error(`The "${key}" parameter name does not exist: ${paramName}`);

            const paramValue = String(lazyParams[paramName]);
            const resolvedValue = await metadataCache.getOrInsert(
                { type: typedKey, id: paramValue }, () => resolver(paramValue));

            if (resolvedValue)
                resolvedPath.push(resolvedValue);
        }
    }

    return {
        title: [ ...resolvedPath, kProductName ].join(' | '),
    };
}

/**
 * Clears cached page metadata entries for the given entity `key`, optionally narrowed to `id`.
 */
export function clearPageMetadataCache(key: EntityType, id?: number | string): void {
    Cache.getInstance('PageMetadata').delete(
        id !== undefined ? { type: key, id: String(id) } : { type: key });
}
