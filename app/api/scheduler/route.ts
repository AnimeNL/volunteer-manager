// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { NextRequest } from 'next/server';
import { forbidden } from 'next/navigation';
import { z } from 'zod/v4';

import { type ActionProps, executeAction } from '../Action';
import { TaskRunner } from '@lib/scheduler/TaskRunner';
import { globalScheduler } from '@lib/scheduler/SchedulerImpl';

import { kTaskResult } from '@lib/database/Types';

/**
 * Interface definition for the Scheduler API, exposed through /api/scheduler.
 */
const kSchedulerDefinition = z.object({
    request: z.object({
        /**
         * The password required to execute the scheduler.
         */
        password: z.string(),

        /**
         * Execution can be requested either by a task Id, information for which will be fetched
         * from the database, or by the task's absolute name.
         */
    }).and(z.union([
        z.object({
            /**
             * Unique ID of the task that should be executed by the scheduler.
             */
            taskId: z.number(),
        }),
        z.object({
            /**
             * Unique name of the task that should be executed by the scheduler.
             */
            taskName: z.string(),
        }),
    ])),
    response: z.object({
        /**
         * Whether the task run was successful.
         */
        success: z.boolean(),
    }),
});

export type SchedulerDefinition = z.infer<typeof kSchedulerDefinition>;

/**
 * The scheduler password used for this build of the Volunteer Manager API.
 */
const kSchedulerPassword = process.env.APP_SCHEDULER_PASSWORD;

type Request = SchedulerDefinition['request'];
type Response = SchedulerDefinition['response'];

/**
 * API that powers the scheduler. While time keeping is done outside of Next.js, we want the actual
 * tasks to be executed within Next.js' context, hence issuing them as API calls.
 */
async function scheduler(request: Request, props: ActionProps): Promise<Response> {
    if (!kSchedulerPassword?.length || request.password !== kSchedulerPassword)
        forbidden();

    const taskRunner = TaskRunner.getOrCreateForScheduler(globalScheduler);
    const success = await taskRunner.executeTask(
        'taskId' in request ? { taskId: request.taskId }
                            : { taskName: request.taskName });

    return {
        success: success === kTaskResult.TaskSuccess,
    };
}

// The /api/scheduler route only provides a single API - call it straight away.
export const POST = (request: NextRequest) =>
    executeAction(request, kSchedulerDefinition, scheduler);
