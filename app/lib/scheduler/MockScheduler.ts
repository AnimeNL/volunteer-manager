// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Scheduler, type TaskIdentifier } from './Scheduler';
import { SchedulerRunner } from './SchedulerRunner';

/**
 * Type describing a task that can be registered with the mock scheduler.
 */
type TaskFunction = () => Promise<void>;

/**
 * Mock implementation of the scheduler which is to be used in testing environments. Provides access
 * to historic invocations and use that allows it to be introspected.
 */
export class MockScheduler extends Scheduler {
    #populated: boolean = false;
    #registeredTasks: Map<string, TaskFunction> = new Map;

    constructor() {
        super(task => this.#handleTask(task));
    }

    /**
     * Gets whether the scheduler has been populated with tasks. This will be initiated by the
     * runner when the `PopulateSchedulerTask` task is scheduled.
     */
    get populated() { return this.#populated; }

    /**
     * Invokes the singular task identified by the given `task`. In the mock scheduler we only
     * support named tasks right now.
     */
    async #handleTask(task: TaskIdentifier): Promise<void> {
        if ('taskId' in task)
            throw new Error(`The MockScheduler only supports named tasks (got: ${task.taskId})`);

        const taskName = task.taskName;

        if (!this.#registeredTasks.has(taskName)) {
            if (taskName === SchedulerRunner.PopulateTaskName)
                this.#populated = true;
            else
                throw new Error(`The MockScheduler does not know the given task ("${taskName}")`);
        } else {
            const handler = this.#registeredTasks.get(taskName)!;
            await handler();
        }
    }

    /**
     * Registers the task identified by the given `taskName` to be handled by the given `handler`.
     * Tasks may only be registered once, known tasks will throw an exception.
     */
    registerTask(taskName: string, handler: TaskFunction): void {
        if (this.#registeredTasks.has(taskName))
            throw new Error(`The given task ("${taskName}") has already been registered`);

        this.#registeredTasks.set(taskName, handler);
    }
}
