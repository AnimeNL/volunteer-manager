// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Cache } from '@lib/cache/Cache';
import { readUserSetting, writeUserSetting, writeUserSettings } from './UserSettings';
import { useMockConnection } from '@lib/database/Connection';

describe('UserSettings', () => {
    const mockConnection = useMockConnection();
    const cache = Cache.getInstance('UserSettings');

    beforeEach(() => cache.clear());

    it('should update the cache only after the database transaction commits', async () => {
        cache.set(42, { 'admin-theme-color': '#111111' });

        mockConnection.expect('beginTransaction');
        mockConnection.expect('insert', () => {
            // Cache must still hold the previous value before the transaction commits:
            expect(cache.get(42)).toEqual({ 'admin-theme-color': '#111111' });
            return 1;
        });
        mockConnection.expect('commit');

        await writeUserSetting(42, 'admin-theme-color', '#222222');

        expect(await readUserSetting(42, 'admin-theme-color')).toBe('#222222');
    });

    it('should leave cached settings untouched if the database transaction fails', async () => {
        cache.set(42, { 'admin-theme-color': '#111111' });

        mockConnection.expect('beginTransaction');
        mockConnection.expect('insert', () => {
            throw new Error('Simulated database failure');
        });
        mockConnection.expect('rollback');

        await expect(
            writeUserSettings(42, { 'admin-theme-color': '#222222' })
        ).rejects.toThrow('Simulated database failure');

        expect(cache.get(42)).toEqual({ 'admin-theme-color': '#111111' });
    });

    it('should remove deleted settings from the cache after commit', async () => {
        cache.set(42, { 'admin-theme-color': '#111111' });

        mockConnection.expect('beginTransaction');
        mockConnection.expect('delete', () => {
            expect(cache.get(42)).toEqual({ 'admin-theme-color': '#111111' });
            return 1;
        });
        mockConnection.expect('commit');

        await writeUserSetting(42, 'admin-theme-color', undefined);

        expect(cache.get(42)).toEqual({});
    });
});
