// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { TaskResult } from './Task';
import { MockScheduler } from './MockScheduler';
import { TaskRunner } from './TaskRunner';
import { useMockConnection } from '@lib/database/Connection';

import { kTaskResult } from '@lib/database/Types';

describe('TaskRunner', () => {
    const mockConnection = useMockConnection();

    interface InstallTaskContextOptions {
        taskName: string;
        params?: unknown;
        parentTaskId?: number;
        intervalMs?: number;
    }

    function installTaskContext(taskId: number, options?: InstallTaskContextOptions) {
        mockConnection.expect('selectOneRow', (query, params) => {
            expect(params).toHaveLength(1);
            expect(params[0]).toEqual(taskId);
            if (!options)
                return undefined;

            return {
                taskId,
                taskName: options.taskName,
                params: JSON.stringify(options.params ?? { /* no parameters */ }),
                parentTaskId: options.parentTaskId,
                intervalMs: options.intervalMs ?? null,
            };
        });
    }

    interface TaskUpdateResult {
        taskId: number;
        taskInvocationResult: TaskResult;
        taskInvocationLogs: string;
        taskInvocationTimeMs: number;
    }

    interface TaskUpdateWithScheduleResult extends TaskUpdateResult {
        scheduledTaskName: string;
        scheduledTaskParams: string;
        scheduledTaskParentTaskId?: number;
        scheduledTaskIntervalMs: number;
    }

    function expectTaskUpdate(expectSchedule: true): Promise<TaskUpdateWithScheduleResult>;
    function expectTaskUpdate(expectSchedule: false): Promise<TaskUpdateResult>;
    function expectTaskUpdate(expectSchedule: boolean) {
        return new Promise(resolve => {
            let updateResult: TaskUpdateResult;

            mockConnection.expect('beginTransaction');
            mockConnection.expect('update', (query, params) => {
                expect(params).toHaveLength(4);
                updateResult = {
                    taskId: params[3],
                    taskInvocationResult: params[0],
                    taskInvocationLogs: params[1],
                    taskInvocationTimeMs: params[2],
                };

                if (!expectSchedule)
                    resolve(updateResult);
            });

            if (expectSchedule) {
                mockConnection.expect('insertReturningLastInsertedId', (query, params) => {
                    expect(params).toHaveLength(5);
                    resolve({
                        ...updateResult,
                        scheduledTaskName: params[0],
                        scheduledTaskParams: params[1],
                        scheduledTaskParentTaskId: params[2],
                        scheduledTaskIntervalMs: params[3],
                    });

                    return /* last inserted id= */ 9001;
                });
            }

            mockConnection.expect('commit');
        });
    }

    it('should be able to execute built-in named tasks', async () => {
        const taskRunner = TaskRunner.getOrCreateForScheduler(new MockScheduler);

        // (1) Simple tasks
        {
            const result = await taskRunner.executeTask({ taskName: 'NoopTask' });
            expect(result).toEqual(kTaskResult.TaskSuccess);
        }

        // (2) Complex tasks - failure w/ invalid parameters
        {
            const result = await taskRunner.executeTask({ taskName: 'NoopComplexTask' });
            expect(result).toEqual(kTaskResult.InvalidParameters);
        }

        // (3) Complex tasks - success due to parameterized behaviour
        {
            const result = await taskRunner.executeTask(
                { taskName: 'NoopComplexTask' }, { succeed: true });

            expect(result).toEqual(kTaskResult.TaskSuccess);
        }

        // (4) Complex tasks - failure due to parameterized behaviour
        {
            const result = await taskRunner.executeTask(
                { taskName: 'NoopComplexTask' }, { succeed: false });

            expect(result).toEqual(kTaskResult.TaskFailure);
        }
    });

    it('should reject tasks when they refer to an invalid built-in named task', async () => {
        const taskRunner = TaskRunner.getOrCreateForScheduler(new MockScheduler);

        // (1) Executing a task using named execution.
        {
            const result = await taskRunner.executeTask({ taskName: 'InvalidTask' });
            expect(result).toEqual(kTaskResult.InvalidNamedTask);
        }

        // (2) Executing a task using static database-driven execution.
        {
            installTaskContext(42, { taskName: 'InvalidTask' });

            const updatePromise = expectTaskUpdate(/* expectSchedule= */ false);

            const result = await taskRunner.executeTask({ taskId: 42 });
            expect(result).toEqual(kTaskResult.InvalidNamedTask);

            const update = await updatePromise;
            expect(update.taskId).toEqual(42);
            expect(update.taskInvocationResult).toEqual(kTaskResult.InvalidNamedTask);
            expect(update.taskInvocationLogs).toEqual('[]');
            expect(update.taskInvocationTimeMs).toBeGreaterThan(0);
        }
    });

    it('should validate the parameters for a task ahead of executing it', async () => {
        const taskRunner = TaskRunner.getOrCreateForScheduler(new MockScheduler);

        // (1) Executing a task using named execution.
        {
            const result = await taskRunner.executeTask(
                { taskName: 'NoopComplexTask' }, { succeed: 12345678 });

            expect(result).toEqual(kTaskResult.InvalidParameters);
        }

        // (2) Executing a task using static database-driven execution.
        {
            installTaskContext(100, {
                taskName: 'NoopComplexTask',
                params: { succeed: 12345678 },
            });

            const updatePromise = expectTaskUpdate(/* expectSchedule= */ false);

            const result = await taskRunner.executeTask({ taskId: 100 });
            expect(result).toEqual(kTaskResult.InvalidParameters);

            const update = await updatePromise;
            expect(update.taskId).toEqual(100);
            expect(update.taskInvocationResult).toEqual(kTaskResult.InvalidParameters);
            expect(update.taskInvocationLogs).toEqual('[]');
            expect(update.taskInvocationTimeMs).toBeGreaterThan(0);
        }
    });

    it('should be able to automatically reschedule repeating tasks', async () => {
        const scheduler = new MockScheduler;
        const taskRunner = TaskRunner.getOrCreateForScheduler(scheduler);

        expect(scheduler.taskQueueSize).toEqual(0);

        installTaskContext(100, {
            taskName: 'NoopComplexTask',
            params: { succeed: true, logs: true },
            intervalMs: 1000,
        });

        const updatePromise = expectTaskUpdate(/* expectSchedule= */ true);

        expect(scheduler.taskQueueSize).toEqual(0);

        const result = await taskRunner.executeTask({ taskId: 100 });
        expect(result).toEqual(kTaskResult.TaskSuccess);

        expect(scheduler.taskQueueSize).toEqual(1);

        const update = await updatePromise;
        expect(update.taskId).toEqual(100);
        expect(update.taskInvocationResult).toEqual(kTaskResult.TaskSuccess);
        expect(update.taskInvocationTimeMs).toBeGreaterThan(0);
        expect(update.scheduledTaskName).toEqual('NoopComplexTask');
        expect(update.scheduledTaskParams).toEqual('{"succeed":true,"logs":true}');
        expect(update.scheduledTaskIntervalMs).toEqual(1000);

        const logs = JSON.parse(update.taskInvocationLogs);
        expect(logs).toHaveLength(1);

        expect(logs[0].severity).toEqual('Info');
        expect(logs[0].time).toBeGreaterThan(0);
        expect(logs[0].message).toEqual('Parameters=');
        expect(logs[0].data).toEqual([ { succeed: true, logs: true } ]);
    });

    it('should be able to have tasks modify their interval if they so desire', async () => {
        const taskRunner = TaskRunner.getOrCreateForScheduler(new MockScheduler);

        installTaskContext(100, {
            taskName: 'NoopComplexTask',
            params: { succeed: true, intervalMs: 60000 },
            intervalMs: 120000,
        });

        const updatePromise = expectTaskUpdate(/* expectSchedule= */ true);
        const result = await taskRunner.executeTask({ taskId: 100 });
        expect(result).toEqual(kTaskResult.TaskSuccess);

        const update = await updatePromise;
        expect(update.taskId).toEqual(100);
        expect(update.taskInvocationResult).toEqual(kTaskResult.TaskSuccess);
        expect(update.scheduledTaskName).toEqual('NoopComplexTask');
        expect(update.scheduledTaskParams).toEqual('{"succeed":true,"intervalMs":60000}');
        expect(update.scheduledTaskIntervalMs).toEqual(60000);
    });

    it('should stop tasks from modifying their interval when manually triggered', async () => {
        const taskRunner = TaskRunner.getOrCreateForScheduler(new MockScheduler);

        installTaskContext(100, {
            taskName: 'NoopComplexTask',
            params: { succeed: true, intervalMs: 60000 },
            intervalMs: /* missing= */ undefined,
        });

        const updatePromise = expectTaskUpdate(/* expectSchedule= */ false);
        const result = await taskRunner.executeTask({ taskId: 100 });
        expect(result).toEqual(kTaskResult.TaskSuccess);

        const update = await updatePromise;
        expect(update.taskId).toEqual(100);
        expect(update.taskInvocationResult).toEqual(kTaskResult.TaskSuccess);
    });

    it('should be able to have tasks cancel their repetition if they so desire', async () => {
        const taskRunner = TaskRunner.getOrCreateForScheduler(new MockScheduler);

        installTaskContext(100, {
            taskName: 'NoopComplexTask',
            params: { succeed: true, intervalMs: /* cancel= */ null },
            intervalMs: 120000,
        });

        const updatePromise = expectTaskUpdate(/* expectSchedule= */ false);
        const result = await taskRunner.executeTask({ taskId: 100 });
        expect(result).toEqual(kTaskResult.TaskSuccess);

        const update = await updatePromise;
        expect(update.taskId).toEqual(100);
        expect(update.taskInvocationResult).toEqual(kTaskResult.TaskSuccess);
        expect(Object.hasOwn(update, 'scheduledTaskName')).toBeFalsy();
        expect(Object.hasOwn(update, 'scheduledTaskParams')).toBeFalsy();
        expect(Object.hasOwn(update, 'scheduledTaskIntervalMs')).toBeFalsy();
    });

    it('should reject tasks when the given taskId is not known to the database', async () => {
        const taskRunner = TaskRunner.getOrCreateForScheduler(new MockScheduler);

        installTaskContext(100, /* not found= */ undefined);

        const invalidResult = await taskRunner.executeTask({ taskId: 100 });
        expect(invalidResult).toEqual(kTaskResult.InvalidTaskId);

        installTaskContext(101, { taskName: 'NoopTask' });

        const validResultUpdatePromise = expectTaskUpdate(/* expectSchedule= */ false);
        const validResult = await taskRunner.executeTask({ taskId: 101 });
        expect(validResult).toEqual(kTaskResult.TaskSuccess);

        expect((await validResultUpdatePromise).taskInvocationResult).toEqual(
            kTaskResult.TaskSuccess);

        installTaskContext(102, { taskName: 'NoopComplexTask', params: { succeed: false } });

        const validFailureUpdatePromise = expectTaskUpdate(/* expectSchedule= */ false);
        const validFailure = await taskRunner.executeTask({ taskId: 102 });
        expect(validFailure).toEqual(kTaskResult.TaskFailure);

        expect((await validFailureUpdatePromise).taskInvocationResult).toEqual(
            kTaskResult.TaskFailure);
    });
});
