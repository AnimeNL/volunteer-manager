// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { vi } from 'vitest';

import { MockScheduler } from './MockScheduler';
import { SchedulerRunner, kMaximumExceptionMultiplier, kSchedulerRunnerIntervalMs }
    from './SchedulerRunner';

describe('SchedulerRunner', () => {
    vi.useFakeTimers();

    it('can provide execution for any number of schedulers', async () => {
        const runner = SchedulerRunner.createInstanceForTesting();
        expect(runner.active).toBeFalsy();

        const runLoopPromise = runner.runLoop();
        expect(runner.active).toBeTruthy();

        const firstScheduler = new MockScheduler();
        const secondScheduler = new MockScheduler();

        // First run: no schedulers should be executed.
        {
            await vi.advanceTimersToNextTimerAsync();

            expect(runner.active).toBeTruthy();
            expect(firstScheduler.executionCount).toBe(0n);
            expect(secondScheduler.executionCount).toBe(0n);

            expect(firstScheduler.taskQueueSize).toBe(0);
            expect(secondScheduler.taskQueueSize).toBe(0);

            expect(firstScheduler.populated).toBeFalsy();
            expect(secondScheduler.populated).toBeFalsy();
        }

        // Second run: only the `firstScheduler` should be executed.
        {
            runner.attachScheduler(firstScheduler);

            expect(firstScheduler.taskQueueSize).toBe(1);
            expect(secondScheduler.taskQueueSize).toBe(0);

            await vi.advanceTimersToNextTimerAsync();

            expect(runner.active).toBeTruthy();
            expect(firstScheduler.executionCount).toBe(1n);
            expect(secondScheduler.executionCount).toBe(0n);

            expect(firstScheduler.taskQueueSize).toBe(0);
            expect(secondScheduler.taskQueueSize).toBe(0);

            expect(firstScheduler.populated).toBeTruthy();
            expect(secondScheduler.populated).toBeFalsy();
        }

        // Third run: both the schedulers should be executed.
        {
            runner.attachScheduler(secondScheduler);

            expect(firstScheduler.taskQueueSize).toBe(0);
            expect(secondScheduler.taskQueueSize).toBe(1);

            await vi.advanceTimersToNextTimerAsync();

            expect(runner.active).toBeTruthy();
            expect(firstScheduler.executionCount).toBe(2n);
            expect(secondScheduler.executionCount).toBe(1n);

            expect(firstScheduler.taskQueueSize).toBe(0);
            expect(secondScheduler.taskQueueSize).toBe(0);

            expect(firstScheduler.populated).toBeTruthy();
            expect(secondScheduler.populated).toBeTruthy();
        }

        // Fourth run: only the `secondScheduler` should be executed.
        {
            runner.detachScheduler(firstScheduler);

            expect(firstScheduler.taskQueueSize).toBe(0);
            expect(secondScheduler.taskQueueSize).toBe(0);

            await vi.advanceTimersToNextTimerAsync();

            expect(runner.active).toBeTruthy();
            expect(firstScheduler.executionCount).toBe(2n);
            expect(secondScheduler.executionCount).toBe(2n);

            expect(firstScheduler.taskQueueSize).toBe(0);
            expect(secondScheduler.taskQueueSize).toBe(0);

            expect(firstScheduler.populated).toBeTruthy();
            expect(secondScheduler.populated).toBeTruthy();
        }

        runner.abort();

        await vi.runAllTimersAsync();
        await runLoopPromise;

        expect(runner.active).toBeFalsy();
    });

    it('deliberately skews when long-running tasks are seen', async () => {
        const runner = SchedulerRunner.createInstanceForTesting();
        const scheduler = new MockScheduler();

        runner.attachScheduler(scheduler);

        scheduler.registerTask('MySlowTask', async () =>
            await new Promise(resolve => setTimeout(resolve, /* one minute= */ 60000)));

        expect(scheduler.populated).toBeFalsy();
        expect(runner.active).toBeFalsy();

        const runLoopPromise = runner.runLoop();

        expect(scheduler.populated).toBeTruthy();
        expect(runner.active).toBeTruthy();

        // Expect invocation of the `MySlowTask` to begin immediately, but then block subsequent
        // executions of the scheduler on its completion.
        {
            scheduler.queueTask({ taskName: 'MySlowTask' }, /* asap= */ 0);

            expect(scheduler.executionCount).toBe(1n);
            await vi.advanceTimersByTimeAsync(kSchedulerRunnerIntervalMs * 1.25);
            expect(scheduler.executionCount).toBe(2n);

            await vi.advanceTimersByTimeAsync(kSchedulerRunnerIntervalMs * 1.25);
            expect(scheduler.executionCount).toBe(2n); // still running

            await vi.advanceTimersByTimeAsync(/* one minute= */ 60000);
            expect(scheduler.executionCount).toBe(3n);
        }

        runner.abort();

        await vi.runAllTimersAsync();
        await runLoopPromise;

        expect(runner.active).toBeFalsy();
    });

    it('exponentally backs off when an exception is seen', async () => {
        const runner = SchedulerRunner.createInstanceForTesting();
        const scheduler = new MockScheduler();

        runner.attachScheduler(scheduler);

        scheduler.registerTask('MyFaultyTask', async () => {
            throw new Error('This task may be broken...');
        });

        expect(scheduler.populated).toBeFalsy();
        expect(runner.active).toBeFalsy();

        const runLoopPromise = runner.runLoop();

        expect(scheduler.populated).toBeTruthy();
        expect(runner.active).toBeTruthy();

        // Disable `console.error()` which will be invoked by the Scheduler when exceptions happen.
        vi.spyOn(console, 'error').mockImplementation(vi.fn());

        // Schedule the first faulty task, which will kick us into exponential back-off mode.
        scheduler.queueTask({ taskName: 'MyFaultyTask' }, 0);
        await vi.advanceTimersToNextTimerAsync();

        // Tests up to the configured `kMaximumExceptionMultiplier` that the time between executions
        // will double, to apply the exponential back-off when exceptions are seen.
        for (let multiplier = 2; multiplier < kMaximumExceptionMultiplier; multiplier *= 2) {
            scheduler.queueTask({ taskName: 'MyFaultyTask' }, 0);

            const currentExecutionCount = scheduler.executionCount;

            await vi.advanceTimersByTimeAsync(kSchedulerRunnerIntervalMs * 1.25);
            expect(scheduler.executionCount).toBe(currentExecutionCount);  // backing off

            await vi.advanceTimersByTimeAsync(kSchedulerRunnerIntervalMs * multiplier);
            expect(scheduler.executionCount).toBe(currentExecutionCount + 1n);
        }

        runner.abort();

        await vi.runAllTimersAsync();
        await runLoopPromise;

        expect(runner.active).toBeFalsy();
    });
});
