// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { MockScheduler } from './MockScheduler';
import { executeTaskNow, scheduleTask } from './index';
import { useMockConnection } from '@lib/database/Connection';

import { kTaskResult } from '@lib/database/Types';

describe('scheduler', () => {
    const mockConnection = useMockConnection();

    it('should be able to schedule tasks without executing them immediately', async () => {
        const scheduler = new MockScheduler;
        expect(scheduler.taskQueueSize).toEqual(0);

        mockConnection.expect('insertReturningLastInsertedId', (query, params) => {
            expect(params).toHaveLength(5);
            expect(params[0]).toEqual('NoopTask');
            return 123;
        });

        const taskId = await scheduleTask({
            taskName: 'NoopTask',
            params: {},
            delayMs: 500,
        }, scheduler);

        expect(taskId).toEqual(123);
        expect(scheduler.taskQueueSize).toEqual(1);
    });

    it('should be able to immediately execute tasks and return whether they succeeded', async () => {
        const scheduler = new MockScheduler;
        expect(scheduler.taskQueueSize).toEqual(0);

        for (const succeed of [ true, false ]) {
            const taskId = succeed ? 200 : 201;
            const taskParams = { succeed };

            mockConnection.expect('insertReturningLastInsertedId', (query, params) => {
                expect(params).toHaveLength(5);
                expect(params[0]).toEqual('NoopComplexTask');
                expect(params[1]).toEqual(JSON.stringify(taskParams));
                return taskId;
            });

            mockConnection.expect('selectOneRow', (query, params) => {
                expect(params).toEqual([ taskId ]);
                return {
                    taskId,
                    taskName: 'NoopComplexTask',
                    params: JSON.stringify(taskParams),
                    parentTaskId: undefined,
                    intervalMs: null,
                };
            });

            let recordedResult: string | undefined;
            mockConnection.expect('beginTransaction');
            mockConnection.expect('update', (query, params) => {
                expect(params).toHaveLength(4);
                expect(params[3]).toEqual(taskId);
                recordedResult = params[0];
            });
            mockConnection.expect('commit');

            const result = await executeTaskNow({
                taskName: 'NoopComplexTask',
                params: taskParams,
            }, scheduler);

            expect(result).toEqual(succeed);
            expect(recordedResult).toEqual(
                succeed ? kTaskResult.TaskSuccess : kTaskResult.TaskFailure);
            expect(scheduler.taskQueueSize).toEqual(0);
        }
    });
});
