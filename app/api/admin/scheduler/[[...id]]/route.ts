// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { NextRequest } from 'next/server';
import { z } from 'zod/v4';

import { type DataTableEndpoints, createDataTableApi } from '../../../createDataTableApi';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { executeAction } from '@app/api/Action';
import { scheduleTask, kScheduleTaskDefinition } from '../scheduleTask';
import db, { tTasks } from '@lib/database';

import { kTaskFormatFn } from '@lib/scheduler/TaskRegistry';
import { kTaskResult } from '@lib/database/Types';

/**
 * Row model an entry from the scheduler.
 */
const kSchedulerRowModel = z.object({
    /**
     * Unique ID of the content as it exists in the database.
     */
    id: z.number(),

    /**
     * Unique ID of the parent task of this task as it exists in the database.
     */
    parentId: z.number().optional(),

    /**
     * State of the task as it should be displayed.
     */
    state: z.enum([ 'pending', 'success', 'warning', 'failure' ]),

    /**
     * Date on which the task has been scheduled to execute.
     */
    date: z.string(),

    /**
     * Name of the task that's been scheduled for execuction.
     */
    task: z.string(),

    /**
     * Interval of the task, in case it's repeating.
     */
    executionInterval: z.number().optional(),

    /**
     * Execution time of the task, in milliseconds, when it's completed.
     */
    executionTime: z.number().optional(),
});

/**
 * The Export API does not require any context.
 */
const kSchedulerContext = z.never();

/**
 * Export type definitions so that the API can be used in `callApi()`.
 */
export type SchedulerEndpoints =
    DataTableEndpoints<typeof kSchedulerRowModel, typeof kSchedulerContext>;

/**
 * Export type definition for the Content DataTable API's Row Model.
 */
export type SchedulerRowModel = z.infer<typeof kSchedulerRowModel>;

/**
 * The Scheduler API is implemented as a regular DataTable API.
 *
 * The following endpoints are provided by this implementation:

 *     GET /api/admin/content
 *     GET /api/admin/content/:id
 */
export const { GET } = createDataTableApi(kSchedulerRowModel, kSchedulerContext, {
    async accessCheck(context, action, props) {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin',
            permission: 'system.internals.scheduler',
        });
    },

    async get({ id }) {
        return {
            success: false,
            error: 'Not yet implemented',
        }
    },

    async list({ pagination }) {
        const tasks = await db.selectFrom(tTasks)
            .select({
                id: tTasks.taskId,
                parentId: tTasks.taskParentTaskId,
                date: tTasks.taskScheduledDate,
                task: tTasks.taskName,
                params: tTasks.taskParams,
                executionResult: tTasks.taskInvocationResult,
                executionInterval: tTasks.taskScheduledIntervalMs,
                executionTime: tTasks.taskInvocationTimeMs,
            })
            .orderBy('date', 'desc nulls first')
            .limitIfValue(pagination ? pagination.pageSize : null)
                .offsetIfValue(pagination ? pagination.page * pagination.pageSize : null)
            .executeSelectPage();

        return {
            success: true,
            rowCount: tasks.count,
            rows: tasks.data.map(row => {
                let taskName = row.task;
                if (Object.hasOwn(kTaskFormatFn, row.task)) {
                    try {
                        const params = JSON.parse(row.params ?? /* no params */ '{}');
                        taskName = kTaskFormatFn[row.task as keyof typeof kTaskFormatFn](params);
                    } catch (_error) { /* no failure handling */ }
                }

                let state: SchedulerRowModel['state'] = 'pending';
                if (!!row.executionResult) {
                    if (row.executionResult === kTaskResult.TaskSuccess) {
                        state = 'success';
                    } else {
                        state = 'failure';
                    }
                }

                return {
                    id: row.id,
                    parentId: row.parentId,
                    state,
                    date: row.date.toString(),
                    task: taskName,
                    executionInterval: row.executionInterval,
                    executionTime: row.executionTime,
                } as const;
            }),
        }
    },
});

/**
 * POST /api/admin/scheduler
 */
export async function POST(request: NextRequest): Promise<Response> {
    return executeAction(request, kScheduleTaskDefinition, scheduleTask);
}
