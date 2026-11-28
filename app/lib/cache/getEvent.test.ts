// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Cache } from './Cache';
import { getEvent } from './getEvent';
import { invalidateCache } from './invalidateCache';
import { useMockConnection } from '@lib/database/Connection';

describe('getEvent', () => {
    const mockConnection = useMockConnection();
    const eventCache = Cache.getInstance('EventCache');
    const urlSlugCache = Cache.getInstance('UrlSlugs');

    beforeEach(() => {
        eventCache.clear();
        urlSlugCache.clear();
    });

    it('should not cache missing events', async () => {
        mockConnection.expect('selectOneRow');

        const result = await getEvent('non-existent');
        expect(result).toBeUndefined();
        expect(eventCache.has('non-existent')).toBeFalsy();
    });

    it('should safely handle invalidation when a null entry is cached', () => {
        eventCache.set('missing-slug', null as any);

        expect(() => invalidateCache('event', { eventSlug: 'missing-slug' })).not.toThrow();
        expect(eventCache.has('missing-slug')).toBeFalsy();
    });

    it('should invalidate both the event cache and URL slug cache by slug', () => {
        eventCache.set('2026', { id: 42, slug: '2026' } as any);
        urlSlugCache.set({ event: 42 }, '2026');

        invalidateCache('event', { eventSlug: '2026' });

        expect(eventCache.has('2026')).toBeFalsy();
        expect(urlSlugCache.has({ event: 42 })).toBeFalsy();
    });
});
