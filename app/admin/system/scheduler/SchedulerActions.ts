// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { z } from 'zod/v4';

import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { executeServerAction } from '@lib/serverAction';
import { rerunTask, scheduleTask } from '@lib/scheduler';

import { kTaskRegistry, type RegisteredTasks } from '@lib/scheduler/TaskRegistry';

/**
 * Zod type that describes the data required when scheduling a new task.
 */
const kCreateSchedulerTaskData = z.object({
    task: z.string(),
    id: z.coerce.number().optional(),
    publish: z.boolean().optional(),
    festivalId: z.coerce.number().optional(),
    skipMutationLogs: z.boolean().optional(),
    succeed: z.boolean().optional(),
});

/**
 * Server action that schedules a new task.
 */
export async function createSchedulerTask(formData: unknown) {
    'use server';
    return executeServerAction(formData, kCreateSchedulerTaskData, async (data, props) => {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin',
            permission: 'system.internals.scheduler',
        });

        if (!Object.hasOwn(kTaskRegistry, data.task)) {
            return {
                success: false,
                error: `Unrecognised task name ("${data.task}")`,
            };
        }

        // Construct task parameters based on the selected task
        let params: any = {};
        if (data.task === 'DutyBookSummaryTask') {
            if (data.id === undefined || data.publish === undefined) {
                return { success: false, error: 'Duty Book ID and publish option are required.' };
            }
            params = { id: data.id, publish: data.publish };
        } else if (data.task === 'ImportActivitiesTask') {
            if (data.festivalId === undefined || data.skipMutationLogs === undefined) {
                return { success: false, error: 'Festival ID and logs option are required.' };
            }
            params = { festivalId: data.festivalId, skipMutationLogs: data.skipMutationLogs };
        } else if (data.task === 'NoopComplexTask') {
            if (data.succeed === undefined) {
                return { success: false, error: 'Succeed option is required.' };
            }
            params = { succeed: data.succeed };
        }

        await scheduleTask({
            taskName: data.task as RegisteredTasks,
            params,
            delayMs: 0,
        });

        return {
            success: true,
            clear: true,
            refresh: true,
            message: `The ${data.task} was successfully scheduled.`,
        };
    });
}

/**
 * Zod type that describes the data required when rerunning an existing task.
 */
const kRerunSchedulerTaskData = z.object({
    taskId: z.coerce.number(),
});

/**
 * Server action that reruns an existing task.
 */
export async function rerunSchedulerTask(formData: unknown) {
    'use server';
    return executeServerAction(formData, kRerunSchedulerTaskData, async (data, props) => {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin',
            permission: 'system.internals.scheduler',
        });

        const rescheduledTaskId = await rerunTask(data.taskId);
        if (!rescheduledTaskId) {
            return {
                success: false,
                error: 'Unable to rerun the selected task.',
            };
        }

        return {
            success: true,
            taskId: rescheduledTaskId,
        };
    });
}
