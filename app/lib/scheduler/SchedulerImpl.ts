// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Scheduler, TaskIdentifier } from './Scheduler';
import { SchedulerBase } from './SchedulerBase';
import { SchedulerRunner } from './SchedulerRunner';

declare namespace globalThis {
    let animeConScheduler: Scheduler;
}

/**
 * Endpoint at which the scheduler frontend can be reached.
 */
const kSchedulerEndpoint =
    `http://${process.env.HOSTNAME || '127.0.0.1'}:${process.env.PORT || '3001'}/api/scheduler`;

/**
 * The scheduler password used for this build of the Volunteer Manager API.
 */
const kSchedulerPassword = process.env.APP_SCHEDULER_PASSWORD;

/**
 * Store the scheduler instance on the `globalThis` global, to avoid creating new instances each
 * time this file is reloaded. This provides consistent behaviour in development environments,
 * although the server will have to be restarted when the SchedulerImpl behaviour changes.
 */
globalThis.animeConScheduler ??= new class extends SchedulerBase {
    constructor() {
        super();

        // Automatically attach the global scheduler to the scheduler runner, so that it will be
        // invoked at a configured cadence to execute any pending tasks.
        SchedulerRunner.getInstance().attachScheduler(this);
    }

    /**
     * Invokes the singular task identified by the given `taskId`. This is done by issuing a fetch
     * to a Next.js-backed API for consistency with the rest of the Volunteer Manager.
     */
    async invoke(task: TaskIdentifier): Promise<void> {
        // TODO: The `kSchedulerEndpoint` endpoint returns a success status for execution of the
        // task. When this is set to `false` we might very well want to re-schedule the task.

        await fetch(kSchedulerEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                password: kSchedulerPassword,
                ...task,
            }),
        });
    }
};

/**
 * The global scheduler used by the Volunteer Manager.
 */
export const globalScheduler = globalThis.animeConScheduler;
