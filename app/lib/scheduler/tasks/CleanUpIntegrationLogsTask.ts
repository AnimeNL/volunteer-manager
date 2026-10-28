// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Task } from '../Task';

/**
 * Task that periodically cleans up old integration logs.
 */
export class CleanUpIntegrationLogsTask extends Task {
    /**
     * The interval at which the cleanup task should run.
     */
    static readonly kInterval = /* 1 week= */ 7 * 86400 * 1000;

    override async execute(): Promise<boolean> {
        this.setIntervalForRepeatingTask(CleanUpIntegrationLogsTask.kInterval);

        return true;
    }
}
