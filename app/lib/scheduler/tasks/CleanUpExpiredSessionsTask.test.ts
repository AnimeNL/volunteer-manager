// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { CleanUpExpiredSessionsTask } from './CleanUpExpiredSessionsTask';
import { TaskContext } from '../TaskContext';
import { useMockConnection } from '@lib/database/Connection';

const mockReadSetting = vi.fn();

vi.mock('@lib/Settings', () => ({
    readSetting: (...args: unknown[]) => mockReadSetting(...args),
}));

describe('CleanUpExpiredSessionsTask', () => {
    const mockConnection = useMockConnection();

    beforeEach(() => {
        mockReadSetting.mockReset();
    });

    it('prunes expired sessions using the default interval when no setting is configured',
        async () =>
    {
        mockReadSetting.mockResolvedValueOnce(undefined);

        const context = TaskContext.forEphemeralTask('CleanUpExpiredSessionsTask', {});
        context.setIntervalForRepeatingTask(/* initial= */ 1000, /* force= */ true);

        const task = new CleanUpExpiredSessionsTask(context);

        mockConnection.expect('delete', (query) => {
            expect(query).toContain('delete from users_sessions');
            return 4;
        });

        const result = await task.execute();
        expect(result).toBe(true);
        expect(mockReadSetting).toHaveBeenCalledWith('session-cleanup-interval-days');
        expect(context.intervalMsForTesting).toBe(
            CleanUpExpiredSessionsTask.kDefaultIntervalDays * 86400 * 1000);
    });

    it('respects a custom interval configured via settings', async () => {
        mockReadSetting.mockResolvedValueOnce(5);

        const context = TaskContext.forEphemeralTask('CleanUpExpiredSessionsTask', {});
        context.setIntervalForRepeatingTask(/* initial= */ 1000, /* force= */ true);

        const task = new CleanUpExpiredSessionsTask(context);
        mockConnection.expect('delete', () => 2);

        const result = await task.execute();
        expect(result).toBe(true);
        expect(context.intervalMsForTesting).toBe(5 * 86400 * 1000);
    });

    it('skips pruning when the configured interval is zero', async () => {
        mockReadSetting.mockResolvedValueOnce(0);

        const context = TaskContext.forEphemeralTask('CleanUpExpiredSessionsTask', {});
        context.setIntervalForRepeatingTask(/* initial= */ 1000, /* force= */ true);

        const task = new CleanUpExpiredSessionsTask(context);

        const result = await task.execute();
        expect(result).toBe(true);
        expect(context.intervalMsForTesting).toBe(
            CleanUpExpiredSessionsTask.kDefaultIntervalDays * 86400 * 1000);
    });
});
