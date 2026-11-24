// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { RegisteredTasks } from './TaskRegistry';
import type { Scheduler } from './Scheduler';
import { TaskRunner } from './TaskRunner';
import { globalScheduler } from './SchedulerImpl';
import { insertTask, scheduleTask, type TaskRequest } from './ScheduleTask';
import db, { tTasks } from '@lib/database';

import { kTaskResult } from '@lib/database/Types';

export { scheduleTask };

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
 * Utility function to immediately execute the given `task` and await its completion. The task will
 * be written to the database and will enjoy full logging, instrumentation, and debugging
 * information in the administration area. Returns whether the task succeeded.
 */
export async function executeTaskNow<ParamsType = unknown>(
    task: Omit<TaskRequest<ParamsType>, 'delayMs' | 'intervalMs'>,
    scheduler?: Scheduler): Promise<boolean>
{
    const taskId = await insertTask({
        ...task,
        delayMs: 0,
    });

    const actualScheduler = scheduler ?? globalScheduler;
    const taskRunner = TaskRunner.getOrCreateForScheduler(actualScheduler);
    const result = await taskRunner.executeTask({ taskId });

    return result === kTaskResult.TaskSuccess;
}
