// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Scheduler } from './Scheduler';
import type { kTaskRegistry } from './TaskRegistry';

import type { TaskResult } from './Task';
import { scheduleTask } from '@lib/scheduler';
import db, { tTasks } from '@lib/database';

/**
 * Configuration that exists for any given task.
 */
interface TaskConfiguration {
    taskId?: number;
    taskName: string;
    params: unknown;
    parentTaskId?: number;
    intervalMs?: number;
}

/**
 * Severity level of an entry logged during task execution.
 */
export const kTaskLogSeverity = {
    Debug: 'Debug',
    Info: 'Info',
    Warning: 'Warning',
    Error: 'Error',
    Exception: 'Exception',
} as const;

/**
 * Severity level of an entry logged during task execution.
 */
export type TaskLogSeverity = typeof kTaskLogSeverity[keyof typeof kTaskLogSeverity];

/**
 * Individual log entry to be stored each time a task requests something to be logged.
 */
interface TaskLogEntry {
    severity: TaskLogSeverity;
    time?: number;
    message: string;
    data: any[];
}

/**
 * Provides the ability for task execution to log information. This will be shown, in chronological
 * order, in the task overview page part of the administration area.
 */
class TaskLogger {
    #logs: TaskLogEntry[] = [];
    #startTime?: bigint;

    /**
     * Returns the current task runtime as a number, or undefined when the task has not started yet.
     */
    private currentRuntimeMs(): number | undefined {
        if (!this.#startTime)
            return undefined;

        return Number(process.hrtime.bigint() - this.#startTime) / 1000 / 1000;
    }

    /**
     * Returns the entries that have been written so far, in order.
     */
    get entries(): readonly TaskLogEntry[] { return this.#logs; }

    /**
     * Sets the task's start time, for relative tracking of log timing information.
     */
    set startTime(value: bigint) { this.#startTime = value; }

    debug(message: string, ...args: any[]) {
        this.#logs.push({
            severity: kTaskLogSeverity.Debug,
            time: this.currentRuntimeMs(),
            data: args, message,
        });
    }

    info(message: string, ...args: any[]) {
        this.#logs.push({
            severity: kTaskLogSeverity.Info,
            time: this.currentRuntimeMs(),
            data: args, message,
        });
    }

    warning(message: string, ...args: any[]) {
        this.#logs.push({
            severity: kTaskLogSeverity.Warning,
            time: this.currentRuntimeMs(),
            data: args, message,
        });
    }

    error(message: string, ...args: any[]) {
        this.#logs.push({
            severity: kTaskLogSeverity.Error,
            time: this.currentRuntimeMs(),
            data: args, message,
        });
    }

    exception(message: string, ...args: any[]) {
        this.#logs.push({
            severity: kTaskLogSeverity.Exception,
            time: this.currentRuntimeMs(),
            data: args, message,
        });
    }
}

/**
 * Maintains context that enables a particular task to be executed, and is able to synchronise that
 * with the database for tasks that are initiated that way.
 */
export class TaskContext {
    /**
     * Initialises a context for an ephemeral task, indicated by the `taskName` and optionally the
     * given `params`.
     */
    static forEphemeralTask(taskName: string, params: unknown) {
        return new TaskContext({ taskName, params });
    }

    /**
     * Initialises a context for a static task, i.e. one that exists in the database, indicated by
     * the given `taskId` and optionally the given `params`. Will return `undefined` when the task
     * does not exist in the database, or has already been executed.
     */
    static async forStaticTask(taskId: number, params: unknown) {
        const task = await db.selectFrom(tTasks)
            .where(tTasks.taskId.equals(taskId))
                .and(tTasks.taskInvocationResult.isNull())
            .select({
                taskId: tTasks.taskId,
                taskName: tTasks.taskName,
                params: tTasks.taskParams,
                parentTaskId: tTasks.taskParentTaskId,
                intervalMs: tTasks.taskScheduledIntervalMs,
            })
            .executeSelectNoneOrOne();

        if (!task)
            return undefined;  // the task does not exist in the database, or has already ran

        let deserializedParams: unknown;
        try {
            deserializedParams = JSON.parse(task.params ?? /* no params= */ '{}');
        } catch (error: any) {
            console.warn('Invalid task found:', error);
            return undefined;  // the task exists, but does not contain valid configuration
        }

        return new TaskContext({
            ...task,
            params: deserializedParams,
        });
    }

    #configuration: TaskConfiguration;
    #executionStart?: bigint;
    #executionFinished?: bigint;
    #intervalMs?: number;
    #logger: TaskLogger;

    private constructor(configuration: TaskConfiguration) {
        this.#configuration = configuration;
        this.#executionStart = undefined;
        this.#executionFinished = undefined;
        this.#intervalMs = configuration.intervalMs;
        this.#logger = new TaskLogger;
    }

    /**
     * Returns the name of the task that should be executed. Not guaranteed to be valid.
     */
    get taskName(): string { return this.#configuration.taskName; }

    /**
     * Returns the parameters with which the task should be executed. Optional.
     */
    get params(): unknown { return this.#configuration.params; }

    /**
     * The interval at which the task will execute next, only exposed for testing purposes.
     */
    get intervalMsForTesting(): number | undefined { return this.#intervalMs; }

    /**
     * Returns the logger that can be used for this task execution.
     */
    get log(): TaskLogger { return this.#logger; }

    /**
     * Returns the runtime of the task once execuction has finished, indicated in milliseconds.
     */
    get runtimeMs(): number | undefined {
        if (!this.#executionStart || !this.#executionFinished)
            return undefined;

        return Number(this.#executionFinished - this.#executionStart) / 1000 / 1000;
    }

    /**
     * Marks that task execution has begun. Will throw if exeuction has already started.
     */
    markTaskExecutionStart(): void {
        if (!!this.#executionStart)
            throw new Error('Task execution has already started, unable to restart');

        this.#executionStart = this.#logger.startTime = process.hrtime.bigint();
    }

    /**
     * Marks that task execution has finished. Will throw if execution has not started yet, and when
     * execution has already been marked as finished.
     */
    markTaskExecutionFinished(): void {
        if (!this.#executionStart)
            throw new Error('Task execution has not started yet');

        if (!!this.#executionFinished)
            throw new Error('Task exeuction has already finished, unable to restart');

        this.#executionFinished = process.hrtime.bigint();
    }

    /**
     * Updates the interval to `intervalMs` in case this is a repeating task. `undefined` can be
     * passed to stop repeating the task altogether. Only has an effect when the task already is set
     * as a repeating task, unless the `force` flag has been set.
     */
    setIntervalForRepeatingTask(intervalMs?: number, force?: boolean): void {
        if (this.#intervalMs === undefined && !force) {
            if (!!intervalMs)
                this.log.debug(`Interval update to ${intervalMs} ignored: not a repeating task`);

            return;
        }

        this.#intervalMs = intervalMs;
    }

    /**
     * Finalizes the task by writing the execution log to the database for static tasks, or by
     * simply declaring victory in case of ephemeral tasks. Will automatically reschedule the task
     * to be exeucted when an interval has been given.
     */
    async finalize(scheduler: Scheduler, result: TaskResult) {
        if (!!this.#configuration.taskId) {
            const dbInstance = db;
            await dbInstance.transaction(async () => {
                await dbInstance.update(tTasks)
                    .set({
                        taskInvocationResult: result,
                        taskInvocationLogs: JSON.stringify(this.#logger.entries),
                        taskInvocationTimeMs: this.runtimeMs,
                    })
                    .where(tTasks.taskId.equals(this.#configuration.taskId!))
                    .executeUpdate();

                if (!!this.#intervalMs) {
                    await scheduleTask({
                        taskName: this.#configuration.taskName as keyof typeof kTaskRegistry,
                        params: this.#configuration.params,
                        parentTaskId: this.#configuration.taskId,
                        delayMs: this.#intervalMs,
                        intervalMs: this.#intervalMs,
                    }, scheduler);
                }
            });
        } else if (!!this.#intervalMs) {
            scheduler.queueTask(
                { taskName: this.#configuration.taskName },
                /* delayMs= */ this.#intervalMs);
        }
    }
}
