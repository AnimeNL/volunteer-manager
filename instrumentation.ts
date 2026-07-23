// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { SchedulerRunner } from '@lib/scheduler/SchedulerRunner';

/**
 * Instrumentation function that will automatically be called whenever a new Next.js server instance
 * is bootstrapped. We use this to create our own event loop using which we invoke the Volunteer
 * Manager's services framework, which is the front-end of our task queue.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') {
        console.info('[Instrumentation] Scheduler disabled: not running on NodeJS');
        return;
    }

    if (process.env.NODE_ENV !== 'production' && process.env.APP_SCHEDULER_ENABLED !== '1') {
        // Fail silent: this is intentionally done by the developer.
        return;
    }

    if (process.env.NODE_ENV === 'production' && process.env.APP_SCHEDULER_ENABLED === '0') {
        // Fail silent: this is intentionally configured on staging environments.
        return;
    }

    // (1) Instantiate and start the SchedulerRunner, which "runs" the scheduler.
    const scheduler = SchedulerRunner.getInstance();
    scheduler.runLoop();

    // (2) Instantiate and start the actual Scheduler.
    await import('@lib/scheduler/SchedulerImpl');
}
