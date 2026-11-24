// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Scheduler } from './Scheduler';
// NOTE: Do not import further dependencies from here, as this file is used outside of the app
// bundle and we want to minimise side-effects.

declare namespace globalThis {
    let animeConSchedulerRunner: SchedulerRunner | undefined;
}

/**
 * Maximum exception multiplier. The multiplier will be doubled each time an exception is thrown
 * when executing a scheduler. The maximum walltime is this multiplied by the interval.
 */
export const kMaximumExceptionMultiplier = 64;

/**
 * Interval, in milliseconds, at which the schedulers should be invoked.
 */
export const kSchedulerRunnerIntervalMs = 1000;

/**
 * Returns a promise that will be resolved after the given number of `ms`. Can be awaited.
 */
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms ?? 8));

/**
 * The SchedulerRunner executes each of the schedulers at a given interval.
 */
export class SchedulerRunner {
    /**
     * Name of the task that will be used to populate a scheduler when it's being attached to the
     * `SchedulerRunner`. This task will be queued automatically and immediately.
     */
    static PopulateTaskName = 'PopulateSchedulerTask';

    /**
     * Returns a new instance of the scheduler runner, must only be used for testing.
     */
    static createInstanceForTesting(): SchedulerRunner {
        return new SchedulerRunner();
    }

    /**
     * Returns the global instance of the Volunteer Manager's Scheduler. Stored on `globalThis` so
     * that hot module reloads do not orphan a running loop.
     */
    static getInstance(): SchedulerRunner {
        globalThis.animeConSchedulerRunner ??= new SchedulerRunner();
        return globalThis.animeConSchedulerRunner;
    }

    #abortController?: AbortController;
    #exceptionPenaltyMultiplier: number;
    #schedulers: Set<Scheduler>;

    private constructor() {
        this.#abortController = undefined;
        this.#exceptionPenaltyMultiplier = 1;
        this.#schedulers = new Set();
    }

    /**
     * Gets whether the runner is presently active.
     */
    get active() { return !!this.#abortController; }

    /**
     * Aborts the runner. Existing invocations will not be reconsidered, however future invocations
     * will. Returns immediately.
     */
    abort() {
        if (!this.#abortController)
            throw new Error('Only active scheduler runners can be aborted');

        this.#abortController.abort();
    }

    /**
     * Attaches the given `scheduler` to the runner, for further repeated execution.
     */
    attachScheduler(scheduler: Scheduler): void {
        this.#schedulers.add(scheduler);

        // Automatically schedule the population task that will refresh the internal status of the
        // scheduler based on the current database configuration.
        scheduler.queueTask({ taskName: SchedulerRunner.PopulateTaskName }, /* delayMs= */ 0);
    }

    /**
     * Detaches the given `scheduler` from the runner, no further invocations will be made.
     */
    detachScheduler(scheduler: Scheduler): void {
        this.#schedulers.delete(scheduler);
    }

    /**
     * Runs each the schedulers in a loop. This method is designed to never return unless the abort
     * signal is issued, which may happen for tests but not in production cases.
     */
    async runLoop() {
        if (!!this.#abortController)
            throw new Error('The Scheduler is already running, cannot start it again');

        this.#abortController = new AbortController();
        while (!this.#abortController.signal.aborted) {
            for (const scheduler of this.#schedulers) {
                try {
                    await scheduler.execute();
                    this.#exceptionPenaltyMultiplier = /* reset= */ 1;
                } catch (error: any) {
                    console.error('[SchedulerRunner] An exception was thrown:', error);
                    if (this.#exceptionPenaltyMultiplier < kMaximumExceptionMultiplier)
                        this.#exceptionPenaltyMultiplier *= 2;
                }
            }

            await wait(this.#exceptionPenaltyMultiplier * kSchedulerRunnerIntervalMs);
        }

        this.#abortController = undefined;
    }
}
