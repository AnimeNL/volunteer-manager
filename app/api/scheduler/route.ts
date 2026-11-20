// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';

import { RecordErrorLog, kLogSeverity } from '@lib/Log';
import { TaskRunner } from '@lib/scheduler/TaskRunner';
import { globalScheduler } from '@lib/scheduler/SchedulerImpl';

import { kTaskResult } from '@lib/database/Types';

/**
 * Request schema for the Scheduler API, exposed through /api/scheduler.
 */
const kSchedulerRequest = z.object({
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
]));

/**
 * API that powers the scheduler. While time keeping is done outside of Next.js, we want the actual
 * tasks to be executed within Next.js' context, hence issuing them as API calls.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ success: false }, { status: 400 });
    }

    const parsed = kSchedulerRequest.safeParse(body);
    if (!parsed.success)
        return NextResponse.json({ success: false }, { status: 400 });

    const schedulerPassword = process.env.APP_SCHEDULER_PASSWORD;
    if (!schedulerPassword?.length || parsed.data.password !== schedulerPassword)
        return NextResponse.json({ success: false }, { status: 403 });

    try {
        const taskRunner = TaskRunner.getOrCreateForScheduler(globalScheduler);
        const result = await taskRunner.executeTask(
            'taskId' in parsed.data ? { taskId: parsed.data.taskId }
                                    : { taskName: parsed.data.taskName });

        return NextResponse.json({
            success: result === kTaskResult.TaskSuccess,
        });

    } catch (error: any) {
        if (!process.env.VITEST_POOL_ID)
            console.error(`Scheduler API (${request.nextUrl.pathname}) threw an exception:`, error);

        RecordErrorLog({
            error,
            requestUrl: request.nextUrl,
            severity: kLogSeverity.Error,
            user: undefined,
        });

        return NextResponse.json({ success: false }, { status: 500 });
    }
}
