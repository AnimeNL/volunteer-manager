// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { z } from 'zod/v4';

import { type UserSettingsMap, clearUserSettings } from '@lib/UserSettings';
import { LogBuilder } from '@lib/log';
import { executeServerAction } from '@lib/serverAction';
import { requireAuthentication } from '@lib/auth';
import { writeSettings } from '@lib/Settings';

/**
 * Set of setting names whose values must be numeric.
 */
const kNumberSettings = new Set([
    'availability-max-event-duration-minutes',
    'availability-time-step-minutes',
    'display-check-in-rate-help-requested-seconds',
    'display-check-in-rate-seconds',
    'display-max-time-since-check-in-days',
    'display-time-offset-seconds',
    'integration-logs-retention-days',
    'retention-number-of-events-to-consider',
    'schedule-activity-list-limit',
    'schedule-check-in-rate-seconds',
    'schedule-del-a-rie-advies-time-limit',
    'schedule-event-view-end-hours',
    'schedule-event-view-start-hours',
    'schedule-recent-shift-count',
    'schedule-search-candidate-fuzziness',
    'schedule-search-candidate-minimum-score',
    'schedule-search-result-limit',
    'schedule-time-step-minutes',
    'session-cleanup-interval-days',
    'system-role-account-user-id',
]);

/**
 * User settings controlling dismissed tiles on the schedule overview page.
 */
const kScheduleOverviewTileSettings: (keyof UserSettingsMap)[] = [
    'user-schedule-hide-feedback-tile',
    'user-schedule-hide-hotel-tile',
    'user-schedule-hide-schedule-tile',
    'user-schedule-hide-ticket-tile',
];

/**
 * Server Action schema for updating system settings.
 */
const kUpdateSettingsData = z.looseObject({ /* freeform key-value mapping */ });

/**
 * Server Action through which system settings can be updated.
 */
export async function updateSettings(formData: unknown) {
    return executeServerAction(formData, kUpdateSettingsData, async (data, props) => {
        await requireAuthentication(props.authenticationContext, 'system.internals.settings');

        const settings: { [k: string]: boolean | number | string } = {};
        for (const [ setting, rawValue ] of Object.entries(data)) {
            let value = rawValue;
            if (kNumberSettings.has(setting) && typeof value === 'string') {
                const parsed = Number(value);
                if (!Number.isNaN(parsed))
                    value = parsed;
            }

            if (typeof value === 'boolean' || typeof value === 'number' ||
                    typeof value === 'string')
            {
                settings[setting] = value;
            }
        }

        const roundToZeroSettings = [
            'display-time-offset-seconds',
        ];

        for (const setting of roundToZeroSettings) {
            if (!Object.hasOwn(settings, setting) || typeof settings[setting] !== 'number')
                continue;

            if (Math.abs(settings[setting] as number) > 60)
                continue;

            settings[setting] = 0;
        }

        await writeSettings(settings as any);

        LogBuilder.for('UpdateSystemSettings')
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                updated: Object.keys(settings),
            });

        return { success: true };
    });
}

/**
 * Server Action schema for resetting dismissed schedule overview tiles across all users.
 */
const kResetScheduleOverviewTilesData = z.object({ /* no parameters */ });

/**
 * Server Action clearing all dismissed schedule overview tile user settings across all users.
 */
export async function resetScheduleOverviewTiles() {
    return executeServerAction({}, kResetScheduleOverviewTilesData, async (_data, props) => {
        await requireAuthentication(props.authenticationContext, 'system.internals.settings');

        const clearedCount = await clearUserSettings(kScheduleOverviewTileSettings);

        LogBuilder.for('UpdateSystemSettings')
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                updated: kScheduleOverviewTileSettings,
            });

        return { clearedCount, success: true };
    });
}
