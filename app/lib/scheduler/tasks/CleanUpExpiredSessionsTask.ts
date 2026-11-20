// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Task } from '../Task';
import { pruneExpiredSessions } from '@lib/auth';
import { readSetting } from '@lib/Settings';

/**
 * Number of milliseconds in a single day.
 */
const kMillisecondsPerDay = 86400 * 1000;

/**
 * Task that periodically prunes expired rows from `users_sessions`.
 */
export class CleanUpExpiredSessionsTask extends Task {
    /**
     * Default interval, in days, between runs when none is configured in the settings.
     */
    static readonly kDefaultIntervalDays = 3;

    override async execute(): Promise<boolean> {
        const configuredIntervalDays =
            await readSetting('session-cleanup-interval-days') ??
            CleanUpExpiredSessionsTask.kDefaultIntervalDays;

        const effectiveIntervalDays = configuredIntervalDays > 0
            ? configuredIntervalDays
            : CleanUpExpiredSessionsTask.kDefaultIntervalDays;

        this.setIntervalForRepeatingTask(effectiveIntervalDays * kMillisecondsPerDay);

        if (configuredIntervalDays <= 0) {
            this.log.info('Expired session cleanup is disabled (interval <= 0); skipping.');
            return true;
        }

        const prunedCount = await pruneExpiredSessions();
        this.log.info(`Cleaned up ${prunedCount} expired session(s).`);

        return true;
    }
}
