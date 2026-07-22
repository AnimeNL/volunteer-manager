// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { CachedTeam } from './Types';
import { Cache } from './Cache';
import { getUrlSlug, invalidateUrlSlug } from './getUrlSlug';
import db, { tTeams } from '@lib/database';

/**
 * Returns basic information about the given `team` uniquely identified by either its ID or slug.
 * Will in most cases return cached information, but might end up issuing a database query.
 */
export async function getTeam(team: number | string): Promise<CachedTeam | undefined> {
    let slug: string;
    if (typeof team === 'string') {
        slug = team;
    } else {
        slug = (await getUrlSlug({ team }))!;
        if (!slug)
            return undefined;
    }

    return await Cache.getInstance('TeamCache').getOrInsert(slug, async (slug) => {
        return db.selectFrom(tTeams)
            .where(tTeams.teamSlug.equals(slug))
            .select({
                id: tTeams.teamId,
                slug: tTeams.teamSlug,
                name: tTeams.teamTitle,
            })
            .executeSelectNoneOrOne();

    }) ?? undefined;
}

/**
 * Invalidates all cached representations of the `team` identified by either its ID or slug.
 */
export async function invalidateTeamCache(team: number | string) {
    const cache = Cache.getInstance('TeamCache');

    if (typeof team === 'string' && cache.has(team)) {
        const { id } = cache.get(team)!;

        cache.delete(team);

        invalidateUrlSlug({ event: id });

    } else if (typeof team === 'number') {
        const slug = await getUrlSlug({ team });
        if (!!slug)
            cache.delete(slug);

        invalidateUrlSlug({ team });
    }
}
