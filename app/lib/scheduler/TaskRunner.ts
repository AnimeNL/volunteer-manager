// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { ZodError } from 'zod/v4';

import type { Scheduler, TaskIdentifier } from './Scheduler';
import { TaskContext } from './TaskContext';
import type { TaskResult, TaskWithParams } from './Task';
import { kTaskRegistry } from './TaskRegistry';

import { kTaskResult } from '@lib/database/Types';

/**
 * Global cache for the task runner instances. One task runner will be lazily created for each
 * scheduler that exists. Instances can be obtained through `TaskRunner::getOrCreateForScheduler()`.
 */
const globalTaskRunnerCache: WeakMap<Scheduler, TaskRunner> = new WeakMap;

/**
 * The task runner is able to execute individual tasks, and maintains detailed logging information
 * on the runtime and success rates. Task runners are strongly associated with a scheduler.
 */
export class TaskRunner {
    #scheduler: Scheduler;

    /**
     * Returns the task runner for the given `scheduler`. A single task runner instance will be
     * created per scheduler, stored in the `globalTaskRunnerCache`.
     */
    static getOrCreateForScheduler(scheduler: Scheduler) {
        if (!globalTaskRunnerCache.has(scheduler))
            globalTaskRunnerCache.set(scheduler, new TaskRunner(scheduler));

        return globalTaskRunnerCache.get(scheduler)!;
    }

    private constructor(scheduler: Scheduler) {
        this.#scheduler = scheduler;
    }

    /**
     * Executes the given `task`. This method will be called in a Next.js context and can access all
     * of the Volunteer Manager infrastructure. Returning the boolean `false` from this method will
     * cause the scheduler to automatically re-schedule this task.
     */
    async executeTask(task: TaskIdentifier, params?: unknown): Promise<TaskResult> {
        if ('taskName' in task)
            return this.executeNamedTask(TaskContext.forEphemeralTask(task.taskName, params));

        const context = await TaskContext.forStaticTask(task.taskId, params);
        if (!context)
            return kTaskResult.InvalidTaskId;

        context.markTaskExecutionStart();
        const result = await this.executeNamedTask(context);
        context.markTaskExecutionFinished();

        await context.finalize(this.#scheduler, result);
        return result;
    }

    /**
     * Executes the task described by the given `context`. Parameters, when given, will be validated
     * against their scheme.
     */
    private async executeNamedTask(context: TaskContext): Promise<TaskResult> {
        if (!Object.hasOwn(kTaskRegistry, context.taskName))
            return kTaskResult.InvalidNamedTask;

        try {
            const taskConstructor = kTaskRegistry[context.taskName as keyof typeof kTaskRegistry];
            const task = new taskConstructor(context);

            let result: boolean | undefined;
            if (task.isSimpleTask()) {
                result = await task.execute();
            } else if (task.isComplexTask()) {
                const complexTask = task as TaskWithParams<unknown>;
                const validatedParams = complexTask.validate(context.params);
                result = await complexTask.execute(validatedParams);
            } else {
                return kTaskResult.UnknownFailure;
            }

            return result ? kTaskResult.TaskSuccess
                          : kTaskResult.TaskFailure;

        } catch (error: any) {
            if (error instanceof ZodError)
                return kTaskResult.InvalidParameters;

            context.log.exception(error.message, error);
            return kTaskResult.TaskException;
        }
    }
}
