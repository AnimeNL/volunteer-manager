// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { CleanUpIntegrationLogsTask } from './CleanUpIntegrationLogsTask';
import { TaskContext } from '../TaskContext';
import { useMockConnection } from '@lib/database/Connection';

const mockReadSetting = vi.fn();

vi.mock('@lib/Settings', () => ({
    readSetting: (...args: unknown[]) => mockReadSetting(...args),
}));

describe('CleanUpIntegrationLogsTask', () => {
    const mockConnection = useMockConnection();

    beforeEach(() => {
        mockReadSetting.mockReset();
    });

    it('cleans up integration logs older than the configured retention period', async () => {
        mockReadSetting.mockResolvedValueOnce(14);

        const context = TaskContext.forEphemeralTask('CleanUpIntegrationLogsTask', {});
        context.setIntervalForRepeatingTask(/* initial= */ 1000, /* force= */ true);

        const task = new CleanUpIntegrationLogsTask(context);

        mockConnection.expect('update', (query, params) => {
            expect(query).toBe(
                'update integrations_logs set log_input = ?, log_output = ? ' +
                'where log_date < ? and (log_input is not null or log_output is not null)');

            expect(params[0]).toBeNull();
            expect(params[1]).toBeNull();
            expect(typeof params[2]).toBe('string');

            return 5;
        });

        const result = await task.execute();
        expect(result).toBe(true);
        expect(mockReadSetting).toHaveBeenCalledWith('integration-logs-retention-days');
        expect(context.intervalMsForTesting).toBe(CleanUpIntegrationLogsTask.kInterval);
    });

    it('skips cleanup when retention days is 0 or not configured', async () => {
        mockReadSetting.mockResolvedValueOnce(undefined);

        const context = TaskContext.forEphemeralTask('CleanUpIntegrationLogsTask', {});
        const task = new CleanUpIntegrationLogsTask(context);

        const result = await task.execute();
        expect(result).toBe(true);
    });
});
