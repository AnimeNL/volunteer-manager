// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import db, { tEnvironments, tTeams, tUsers } from '@lib/database';

/**
 * Type that defines the fetcher for a special value, orthogonal to its data source.
 */
type SpecialValueFetcher = (value: string) => Promise<string | undefined>;

/**
 * Type that defines the sort of special values that are known to this sytem.
 */
type SpecialValues = 'environment' | 'team' | 'user';

/**
 * Name of the product. Will be the last component in every page's title.
 */
const kProductName = 'AnimeCon Volunteer Manager';

/**
 * Cache of the values that can be loaded from the database during metadata generation.
 */
const kSpecialValueCache: { [key in SpecialValues]: Map<any, string> } = {
    environment: new Map<string, string>(),
    team: new Map<string, string>(),
    user: new Map<number, string>(),
};

/**
 * Fetchers that can obtain a special from the database when required.
 */
const kSpecialValueFetcher: { [key in SpecialValues]: SpecialValueFetcher } = {
    environment: async (value: string) => {
        return await db.selectFrom(tEnvironments)
            .where(tEnvironments.environmentDomain.equals(value))
                .and(tEnvironments.environmentDeleted.isNull())
            .selectOneColumn(tEnvironments.environmentTitle)
            .executeSelectNoneOrOne() ?? undefined;
    },

    team: async (value: string) => {
        return await db.selectFrom(tTeams)
            .where(tTeams.teamSlug.equals(value))
            .selectOneColumn(tTeams.teamTitle)
            .executeSelectNoneOrOne() ?? undefined;
    },

    user: async (value: string) => {
        return await db.selectFrom(tUsers)
            .where(tUsers.userId.equals(parseInt(value, /* radix= */ 10)))
            .selectOneColumn(tUsers.name)
            .executeSelectNoneOrOne() ?? undefined;
    },
};

/**
 * Value of a path component in the title that will be generated. Strings are included as-is,
 * whereas special value types are keyed by the type of value (e.g. a user account), and valued by
 * the name of the parameter that indicates the relevant unique ID.
 *
 * Special value types are:
 *
 *   { environment } - the parameter must include the environment's domain
 *   { team } - the parameter must include the team's URL-safe slug
 *   { user } - the parameter must include the user ID
 */
type PathValue = string | { environment: string } | { team: string } | { user: string };

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
 * Composes the metadata for the current page by completing the `path` with the given `props`. When
 * values are loaded from the database, they will automatically be cached indefinitely until the
 * cache is manually pruned.
 */
async function generateMetadata(props: PageProps<any>, path: PathValue[]): Promise<Metadata> {
    let lazyParamsInitialised: boolean = false;
    let lazyParams!: Awaited<typeof props['params']>;

    const resolvedPath = [];
    for (const component of path) {
        if (typeof component === 'string') {
            resolvedPath.push(component);
            continue;
        }

        if (!lazyParamsInitialised) {
            lazyParamsInitialised = true;
            lazyParams = await props.params;
        }

        for (const [ key, fetcher ] of Object.entries(kSpecialValueFetcher)) {
            const typedKey = key as SpecialValues;
            if (!(typedKey in component))
                continue;

            const paramName: string = (component as any)[typedKey];
            if (!lazyParams.hasOwnProperty(paramName))
                throw new Error(`The "${key}" parameter name does not exist: ${paramName}`);

            const paramValue = lazyParams[paramName];
            const specialValue =
                kSpecialValueCache[typedKey].get(paramValue) ||
                await fetcher(paramValue);

            kSpecialValueCache[typedKey].set(paramValue, specialValue!);

            resolvedPath.push(specialValue);
        }
    }

    return {
        title: [ ...resolvedPath, kProductName ].join(' | '),
    };
}

/**
 * Clears the Special Value Cache for the given `key`.
 */
export function clearPageMetadataCache(key: SpecialValues): void {
    kSpecialValueCache[key].clear();
}
