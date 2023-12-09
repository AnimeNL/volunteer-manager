// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { RegisteredTasks } from './TaskRegistry';
import type { Scheduler } from './Scheduler';
import { globalScheduler } from './SchedulerImpl';
import db, { tTasks } from '@lib/database';

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
        dbInstance.fragmentWithType('localDateTime', 'required').sql`
            CURRENT_TIMESTAMP() + INTERVAL ${delayMsConstant} MICROSECOND`;

    const taskId = await dbInstance.insertInto(tTasks)
        .set({
            taskName: task.taskName,
            taskParams: JSON.stringify(task.params),
            taskScheduledIntervalMs: task.intervalMs,
            taskScheduledDate,
        })
        .returningLastInsertedId()
        .executeInsert();

    const actualScheduler = scheduler ?? globalScheduler;
    actualScheduler.queueTask({ taskId }, task.delayMs);

    return taskId;
}
