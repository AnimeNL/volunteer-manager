// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { revalidateTag, updateTag } from 'next/cache';

import { Cache } from './Cache';
import { invalidateCache } from './invalidateCache';

vi.mock('next/cache', () => ({
    revalidateTag: vi.fn(),
    updateTag: vi.fn(),
}));

describe('nextCacheBridge', () => {
    beforeEach(() => {
        vi.mocked(updateTag).mockReset();
        vi.mocked(revalidateTag).mockReset();
        for (const cache of Cache.getAll())
            cache.clear();
    });

    it('invalidates schedule2 metadata, program, knowledge, and team tags', () => {
        Cache.getInstance('EventCache').set('2026', { id: 42, slug: '2026' } as any);
        Cache.getInstance('TeamCache').set('crew', { id: 7, slug: 'crew' } as any);

        invalidateCache('event.slug', { eventId: 42, eventSlug: '2026-new', previousSlug: '2026' });
        expect(updateTag).toHaveBeenCalledWith('schedule-metadata:event:2026-new');
        expect(updateTag).toHaveBeenCalledWith('schedule-metadata:event:2026');

        vi.mocked(updateTag).mockClear();
        invalidateCache('event.program', { festivalId: 9001 });
        expect(updateTag).toHaveBeenCalledWith('schedule-program');

        vi.mocked(updateTag).mockClear();
        invalidateCache('event.content', { eventId: 42, type: 'FAQ', categoryId: 5 });
        expect(updateTag).toHaveBeenCalledWith('schedule-knowledge:42');
        expect(updateTag).toHaveBeenCalledWith('schedule-metadata:category:5');

        vi.mocked(updateTag).mockClear();
        invalidateCache('event.content', { eventId: 42, type: 'Page' });
        expect(updateTag).not.toHaveBeenCalled();

        vi.mocked(updateTag).mockClear();
        invalidateCache('team.visibility', { teamId: 7 });
        expect(updateTag).toHaveBeenCalledWith('schedule-duty-book-teams');
        expect(updateTag).toHaveBeenCalledWith('schedule-metadata:team:crew');
    });

    it('falls back to revalidateTag when updateTag throws outside Server Actions', () => {
        vi.mocked(updateTag).mockImplementation(() => {
            throw new Error('updateTag can only be called from a Server Action');
        });

        invalidateCache('event.program', { festivalId: 9001 });

        expect(updateTag).toHaveBeenCalledWith('schedule-program');
        expect(revalidateTag).toHaveBeenCalledWith('schedule-program', 'max');
    });

    it('no-ops safely when both Next.js cache APIs throw outside request contexts', () => {
        vi.mocked(updateTag).mockImplementation(() => {
            throw new Error('no server action store');
        });
        vi.mocked(revalidateTag).mockImplementation(() => {
            throw new Error('no static generation store');
        });

        expect(() => invalidateCache('event.program', { festivalId: 9001 })).not.toThrow();
    });
});
