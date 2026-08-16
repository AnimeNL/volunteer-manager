// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { z } from 'zod/v4';

import { LogBuilder } from '@lib/log/index';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { executeServerAction } from '@lib/serverAction';
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
    'schedule-time-offset-seconds',
    'schedule-time-step-minutes',
]);

/**
 * Server Action schema for updating system settings.
 */
const kUpdateSettingsData = z.looseObject({ /* freeform key-value mapping */ });

/**
 * Server Action through which system settings can be updated.
 */
export async function updateSettings(formData: unknown) {
    return executeServerAction(formData, kUpdateSettingsData, async (data, props) => {
        executeAccessCheck(props.authenticationContext, 'system.internals.settings');

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
            'schedule-time-offset-seconds',
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
