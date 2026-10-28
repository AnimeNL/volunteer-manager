// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Task } from '../Task';
import { readSetting } from '@lib/Settings';
import db, { tIntegrationsLogs } from '@lib/database';

/**
 * Task that periodically cleans up old integration logs.
 */
export class CleanUpIntegrationLogsTask extends Task {
    /**
     * The interval at which the cleanup task should run.
     */
    static readonly kInterval = /* 1 week= */ 7 * 86400 * 1000;

    /**
     * Default retention period, in days, when none is configured in the settings. A value of zero
     * means that logs will not be cleaned up.
     */
    static readonly kDefaultRetentionDays = 0;

    override async execute(): Promise<boolean> {
        this.setIntervalForRepeatingTask(CleanUpIntegrationLogsTask.kInterval);

        const retentionDays =
            await readSetting('integration-logs-retention-days') ??
            CleanUpIntegrationLogsTask.kDefaultRetentionDays;

        if (retentionDays <= 0) {
            this.log.info('Integration log cleanup is disabled (retentionDays <= 0); skipping.');
            return true;
        }

        const cutoffDate =
            Temporal.Now.zonedDateTimeISO('UTC').subtract({ days: retentionDays });

        this.log.info(
            `Cleaning up integration logs older than ${retentionDays} day(s) ` +
            `(cutoff: ${cutoffDate.toString()})`);

        const affectedRows = await db.update(tIntegrationsLogs)
            .set({
                logInput: null,
                logOutput: null,
            })
            .where(tIntegrationsLogs.logDate.lessThan(cutoffDate))
                .and(tIntegrationsLogs.logInput.isNotNull().or(
                     tIntegrationsLogs.logOutput.isNotNull()))
            .executeUpdate();

        this.log.info(`Cleaned up ${affectedRows} integration log entry/entries.`);

        return true;
    }
}
