// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { cacheLife, cacheTag, updateTag } from 'next/cache';

import { Cache } from '@lib/cache/Cache';
import { readCachedSetting, readSetting, readSettings, writeSetting } from './Settings';
import { useMockConnection } from '@lib/database/Connection';

vi.mock('next/cache', () => ({
    cacheLife: vi.fn(),
    cacheTag: vi.fn(),
    updateTag: vi.fn(),
}));

describe('Settings', () => {
    const mockConnection = useMockConnection();
    const cache = Cache.getInstance('Settings');

    beforeEach(() => {
        cache.clear();
        vi.clearAllMocks();
    });

    it('should query the database on cache miss and cache the result', async () => {
        // First read: cache miss, query database
        mockConnection.expect('selectManyRows', (query, params) => {
            expect(params).toContain('display-confirm-volume-change');
            return [
                {
                    name: 'display-confirm-volume-change',
                    value: 'true',
                },
            ];
        });

        const value1 = await readSetting('display-confirm-volume-change');
        expect(value1).toBe(true);

        // Second read: cache hit, no database query (no expect queued, so query would fail)
        const value2 = await readSetting('display-confirm-volume-change');
        expect(value2).toBe(true);
    });

    it('should cache non-existent settings as undefined to avoid database calls', async () => {
        // First read: cache miss, query database, returns empty
        mockConnection.expect('selectManyRows', (query, params) => {
            expect(params).toContain('display-dev-environment-link');
            return [];
        });

        const value1 = await readSetting('display-dev-environment-link');
        expect(value1).toBeUndefined();

        // Second read: cache hit (as undefined), no database query
        const value2 = await readSetting('display-dev-environment-link');
        expect(value2).toBeUndefined();
    });

    it('should update the cache when writing a setting', async () => {
        mockConnection.expect('beginTransaction');
        mockConnection.expect('delete', (query, params) => {
            expect(params).toContain('display-check-in-rate-seconds');
            return 1;
        });

        mockConnection.expect('insert', (query, params) => {
            expect(params).toContain('display-check-in-rate-seconds');
            expect(params).toContain('120');
            return 1;
        });

        mockConnection.expect('commit');

        await writeSetting('display-check-in-rate-seconds', 120);

        // Subsequent read: should hit the cache and return the new value
        const value = await readSetting('display-check-in-rate-seconds');
        expect(value).toBe(120);
    });

    it('should support deleting settings and cache the deletion', async () => {
        mockConnection.expect('selectManyRows', () => {
            return [
                {
                    name: 'display-dev-environment-link',
                    value: '"https://example.com"',
                },
            ];
        });

        expect(await readSetting('display-dev-environment-link')).toBe('https://example.com');

        // Delete setting: triggers a transaction (delete only, no insert)
        mockConnection.expect('beginTransaction');
        mockConnection.expect('delete', (query, params) => {
            expect(params).toContain('display-dev-environment-link');
            return 1;
        });
        mockConnection.expect('commit');


        await writeSetting('display-dev-environment-link', undefined);

        // Subsequent read: should return undefined from the cache without DB call
        const value = await readSetting('display-dev-environment-link');
        expect(value).toBeUndefined();
    });

    it('should only query database for missing keys in readSettings', async () => {
        mockConnection.expect('selectManyRows', () => {
            return [
                {
                    name: 'display-confirm-volume-change',
                    value: 'true',
                },
            ];
        });

        await readSetting('display-confirm-volume-change');

        // Read both settings. Only 'display-check-in-rate-seconds' should be queried.
        mockConnection.expect('selectManyRows', (query, params) => {
            expect(params).toContain('display-check-in-rate-seconds');
            expect(params).not.toContain('display-confirm-volume-change');
            return [
                {
                    name: 'display-check-in-rate-seconds',
                    value: '60',
                },
            ];
        });

        const results = await readSettings([
            'display-confirm-volume-change',
            'display-check-in-rate-seconds',
        ]);

        expect(results).toEqual({
            'display-confirm-volume-change': true,
            'display-check-in-rate-seconds': 60,
        });
    });

    it('should invalidate Next.js cache tags only when cache-tagged settings change', async () => {
        const expectWrite = () => {
            mockConnection.expect('beginTransaction');
            mockConnection.expect('delete', () => 1);
            mockConnection.expect('insert', () => 1);
            mockConnection.expect('commit');
        };

        // Non-tagged setting: must not call updateTag.
        expectWrite();
        await writeSetting('display-check-in-rate-seconds', 120);
        expect(updateTag).not.toHaveBeenCalled();

        // Cache-tagged setting (initial write): must call updateTag.
        expectWrite();
        await writeSetting('theme-color', '#e91e63');
        expect(updateTag).toHaveBeenCalledTimes(1);
        expect(updateTag).toHaveBeenCalledWith('setting:theme-color');

        // Same value again: must not call updateTag redundantly.
        expectWrite();
        await writeSetting('theme-color', '#e91e63');
        expect(updateTag).toHaveBeenCalledTimes(1);

        // Changed value: must call updateTag again.
        expectWrite();
        await writeSetting('theme-color', '#2196f3');
        expect(updateTag).toHaveBeenCalledTimes(2);
    });

    it('should read cache-tagged settings with fallback and build-phase handling', async () => {
        // Production build phase: returns fallback without querying the database.
        const previousPhase = process.env.NEXT_PHASE;
        process.env.NEXT_PHASE = 'phase-production-build';
        try {
            const buildValue = await readCachedSetting('theme-color', '#303f9f');
            expect(buildValue).toBe('#303f9f');
            expect(cacheTag).toHaveBeenCalledWith('settings', 'setting:theme-color');
            expect(cacheLife).toHaveBeenCalledWith({ stale: 300, revalidate: 1, expire: 300 });
        } finally {
            process.env.NEXT_PHASE = previousPhase;
        }

        // Runtime read: queries DB on cache miss and caches with 'max' lifetime.
        vi.clearAllMocks();
        mockConnection.expect('selectManyRows', () => [
            {
                name: 'web-vitals-reporting',
                value: 'true',
            },
        ]);

        const runtimeValue = await readCachedSetting('web-vitals-reporting', false);
        expect(runtimeValue).toBe(true);
        expect(cacheTag).toHaveBeenCalledWith('settings', 'setting:web-vitals-reporting');
        expect(cacheLife).toHaveBeenCalledWith('max');
    });
});
