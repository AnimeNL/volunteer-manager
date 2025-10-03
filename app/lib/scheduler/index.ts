// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { RegisteredTasks } from './TaskRegistry';
import type { Scheduler } from './Scheduler';
import { TemporalTypeAdapter } from '@lib/database/TemporalTypeAdapter';
import type { Temporal } from '@lib/Temporal';
import { globalScheduler } from './SchedulerImpl';

import db, { tTasks } from '@lib/database';

/**
 * Reschedules the task identified by the given `taskId` to run again, optionally on the given
 * `scheduler`. The task will be executed immediately. Only tasks that have already executed can be
 * rerun, and their interval will not carry over.
 */
export async function rerunTask(taskId: number): Promise<undefined | number> {
    const taskInfo = await db.selectFrom(tTasks)
        .where(tTasks.taskId.equals(taskId))
            .and(tTasks.taskInvocationResult.isNotNull())
        .select({
            taskName: tTasks.taskName,
            params: tTasks.taskParams,
        })
        .executeSelectNoneOrOne();

    if (!taskInfo)
        return undefined;  // unable to rerun the `taskId`

    return await scheduleTask({
        taskName: taskInfo.taskName as RegisteredTasks,
        params: JSON.parse(taskInfo.params),
        parentTaskId: taskId,
        delayMs: 0,
        intervalMs: /* no interval= */ undefined,
    });
}

/**
 * Options that must be given when scheduling a new task.
 */
interface TaskRequest<ParamsType = unknown> {
    /**
     * Name of the task that should be registered.
     */
    taskName: RegisteredTasks;

    /**
     * Parameters that should be passed to the task, if any.
     */
    params: ParamsType;

    /**
     * When known, the Id of the original task that was ran with this given configuration.
     */
    parentTaskId?: number;

    /**
     * Time after which the task should be executed, in milliseconds.
     */
    delayMs: number;

    /**
     * Optional interval at which the task should repeat itself, in milliseconds.
     */
    intervalMs?: number;
}

/**
 * Utility function to schedule the given `task` using the scheduler. The task will be written to
 * the database and will enjoy full debugging information in the administration area.
 */
export async function scheduleTask<ParamsType = unknown>(
    task: TaskRequest<ParamsType>, scheduler?: Scheduler): Promise<number>
{
    const dbInstance = db;

    const delayMsConstant = dbInstance.const(task.delayMs * 1000, 'int');
    const taskScheduledDate =
        dbInstance.fragmentWithType<Temporal.ZonedDateTime>(
            'customLocalDateTime', 'timestamp', 'required', TemporalTypeAdapter).sql`
                CURRENT_TIMESTAMP() + INTERVAL ${delayMsConstant} MICROSECOND`;

    const taskId = await dbInstance.insertInto(tTasks)
        .set({
            taskName: task.taskName,
            taskParams: JSON.stringify(task.params),
            taskParentTaskId: task.parentTaskId,
            taskScheduledIntervalMs: task.intervalMs,
            taskScheduledDate,
        })
        .returningLastInsertedId()
        .executeInsert();

    const actualScheduler = scheduler ?? globalScheduler;
    actualScheduler.queueTask({ taskId }, task.delayMs);

    return taskId;
}
