// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Cache } from './Cache';
import { getTeam, invalidateTeamCache } from './getTeam';
import { useMockConnection } from '@lib/database/Connection';

describe('getTeam', () => {
    const mockConnection = useMockConnection();
    const teamCache = Cache.getInstance('TeamCache');
    const urlSlugCache = Cache.getInstance('UrlSlugs');

    beforeEach(() => {
        teamCache.clear();
        urlSlugCache.clear();
    });

    it('should not cache missing teams', async () => {
        mockConnection.expect('selectOneRow');

        const result = await getTeam('non-existent');
        expect(result).toBeUndefined();
        expect(teamCache.has('non-existent')).toBeFalsy();
    });

    it('should safely handle invalidation when a null entry is cached', async () => {
        teamCache.set('missing-slug', null as any);

        await expect(invalidateTeamCache('missing-slug')).resolves.toBeUndefined();
        expect(teamCache.has('missing-slug')).toBeFalsy();
    });

    it('should invalidate both the team cache and team URL slug cache by slug', async () => {
        teamCache.set('crew', { id: 7, slug: 'crew' } as any);
        urlSlugCache.set({ team: 7 }, 'crew');
        urlSlugCache.set({ event: 7 }, 'event-7');

        await invalidateTeamCache('crew');

        expect(teamCache.has('crew')).toBeFalsy();
        expect(urlSlugCache.has({ team: 7 })).toBeFalsy();
        expect(urlSlugCache.has({ event: 7 })).toBeTruthy();
    });
});
