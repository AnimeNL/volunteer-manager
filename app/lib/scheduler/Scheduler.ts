// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { PriorityQueue, type PriorityQueueComparator } from './PriorityQueue';

/**
 * Unique identifier for a task that is to be executed by the scheduler.
 */
export type TaskIdentifier = { taskId: number } | { taskName: string };

/**
 * Callback invoked by the scheduler when a queued task is due for execution.
 */
type TaskInvoker = (task: TaskIdentifier) => Promise<void>;

/**
 * Information stored for a task that's due to be invoked at a particular time.
 */
interface QueuedTask {
    /**
     * The time, as returned by `process.hrtime.bigint()` (thus monotonically increasing), at which
     * the task should be invoked.
     */
    runtime: bigint;

    /**
     * The task that should be invoked at the configured `runtime`.
     */
    task: TaskIdentifier;
}

/**
 * Comparator that can be used to compare two queued tasks. The task that will be executed soonest
 * will be sorted at the top of the priority queue, everything else will follow thereafter.
 */
const QueuedTaskComparator: PriorityQueueComparator<QueuedTask> =
    (lhs: QueuedTask, rhs: QueuedTask) => {
        return rhs.runtime > lhs.runtime ? -1 : 1;
    };

/**
 * Scheduler that maintains a priority queue of tasks and invokes them as they become due.
 */
export class Scheduler {
    #executionCount: bigint;
    #invocationCount: bigint;
    #invoker: TaskInvoker;
    #lastExecution?: bigint;
    #lastInvocation?: bigint;

    #taskQueue: PriorityQueue<QueuedTask>;

    constructor(invoker: TaskInvoker) {
        this.#executionCount = 0n;
        this.#invocationCount = 0n;
        this.#invoker = invoker;
        this.#lastExecution = undefined;
        this.#lastInvocation = undefined;

        this.#taskQueue = new PriorityQueue(QueuedTaskComparator);
    }

    /**
     * Returns the number of times that the scheduler has been executed.
     */
    get executionCount() { return this.#executionCount; }

    /**
     * Returns the number of invocations that the scheduler made to running actual jobs.
     */
    get invocationCount() { return this.#invocationCount; }

    /**
     * Returns the monotonically increasing high-resolution timestamp at which the scheduler was
     * last executed. `undefined` signals that the scheduler has never been executed yet.
     */
    get lastExecution() { return this.#lastExecution; }

    /**
     * Returns the monotonically increasing high-resolution timestamp at which the scheduler last
     * invocated a task. `undefined` signals that no task has been executed yet.
     */
    get lastInvocation() { return this.#lastInvocation; }

    /**
     * Returns the number of tasks that currently reside in the task queue.
     */
    get taskQueueSize() { return this.#taskQueue.size(); }

    /**
     * Clears all tasks from the scheduler. No further tasks will be invoked until one is queued.
     */
    clearTasks(): void {
        this.#taskQueue.clear();
    }

    /**
     * Queues the given `task` to be executed by the scheduler after the given `delayMs`, which is
     * given in milliseconds. Returns immediately. May be executed from a NextJS environment.
     */
    queueTask(task: TaskIdentifier, delayMs: number): void {
        const currentTimeNs = process.hrtime.bigint();
        const delayNs = BigInt(delayMs) * 1000n * 1000n;

        this.#taskQueue.push({
            runtime: currentTimeNs + delayNs,
            task,
        });
    }

    /**
     * Executes a single round of the scheduler. Will be called once per second in normal operation,
     * although exceptions thrown by this method will add an exponential back-off (with a ceiling).
     */
    async execute(): Promise<void> {
        this.#executionCount++;
        this.#lastExecution = process.hrtime.bigint();

        if (!this.#taskQueue.size())
            return;  // the task queue is empty

        const currentTimeNs = process.hrtime.bigint();

        const pendingTask = this.#taskQueue.front()!;
        if (pendingTask.runtime > currentTimeNs)
            return;  // the task is not ready to be invoked yet

        this.#taskQueue.pop();
        {
            this.#invocationCount++;
            this.#lastInvocation = process.hrtime.bigint();

            await this.invoke(pendingTask.task);
        }
    }

    /**
     * Invokes the singular task identified by the given `task`.
     */
    async invoke(task: TaskIdentifier): Promise<void> {
        await this.#invoker(task);
    }
}
