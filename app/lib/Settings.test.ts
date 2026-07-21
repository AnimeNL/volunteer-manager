// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Cache } from '@lib/cache/Cache';
import { readSetting, readSettings, writeSetting } from './Settings';
import { useMockConnection } from '@lib/database/Connection';

describe('Settings', () => {
    const mockConnection = useMockConnection();
    const cache = Cache.getInstance('Settings');

    beforeEach(() => cache.clear());

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
});
