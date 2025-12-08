// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden } from 'next/navigation';
import { z } from 'zod/v4';

import type { ActionProps } from '../Action';
import type { ApiDefinition, ApiRequest, ApiResponse } from '../Types';
import { writeUserSettings, type UserSettingsMap } from '@lib/UserSettings';

/**
 * Interface definition for the Settings API, exposed through /api/auth/settings.
 */
export const kSettingsDefinition = z.object({
    /**
     * Input is any key-value pair that resolves to a known user setting.
     */
    request: z.record(z.string(), z.any()),
    response: z.strictObject({
        /**
         * Whether the setting(s) were updated successfully.
         */
        success: z.boolean(),

        /**
         * The error message that occurred when `success` is not set to true.
         */
        error: z.string().optional(),
    }),
});

export type SettingsDefinition = ApiDefinition<typeof kSettingsDefinition>;

type Request = ApiRequest<typeof kSettingsDefinition>;
type Response = ApiResponse<typeof kSettingsDefinition>;

/**
 * The string representation of the type expected for the setting named `Key`.
 */
type SettingStringType<Key extends keyof UserSettingsMap> =
    UserSettingsMap[Key] extends boolean ? 'boolean'
        : UserSettingsMap[Key] extends number ? 'number'
        : UserSettingsMap[Key] extends string ? 'string' : 'unknown';

/**
 * API that allows users to change their user settings.
 */
export async function settings(request: Request, props: ActionProps): Promise<Response> {
    if (!props.user)
        forbidden();

    // User settings that are allowed to be updated using this interface.
    const kAllowedUserSettings: { [k in keyof UserSettingsMap]: SettingStringType<k> } = {
        'user-admin-event-finance-configuration': 'boolean',
        'user-admin-experimental-dark-mode': 'boolean',
        'user-admin-experimental-responsive': 'boolean',
        'user-admin-knowledge-expand-categories': 'boolean',
        'user-admin-schedule-date': 'string',
        'user-admin-schedule-expand-sections': 'string',
        'user-admin-schedule-expand-history': 'boolean',
        'user-admin-schedule-expand-warnings': 'boolean',
        'user-admin-schedule-highlight-shifts': 'string',
        'user-admin-schedule-inclusive-shifts': 'boolean',
        'user-admin-shifts-display-other-teams': 'boolean',
        'user-admin-shifts-expand-shifts': 'boolean',
        'user-admin-volunteers-columns-filter': 'string',
        'user-admin-volunteers-columns-hidden': 'string',
        'user-admin-volunteers-expand-notes': 'boolean',
        'user-admin-volunteers-expand-shifts': 'boolean',
        'user-ai-example-messages': 'string',
        'user-ai-example-messages-promo-time': 'number',

        // User settings that cannot be updated through this mechanism:
        'ai-example-messages': 'unknown',
    };

    const settingsToUpdate: { [k in keyof UserSettingsMap]?: UserSettingsMap[k] } = {};
    for (const [ setting, value ] of Object.entries(request)) {
        if (!Object.hasOwn(kAllowedUserSettings, setting)) {
            console.error(`Unrecognised setting: ${setting}`);
            continue;
        }

        const expectedType = kAllowedUserSettings[setting as keyof UserSettingsMap];
        if (expectedType === 'unknown')
            return { success: false, error: 'Attempting to update an immutable user setting' };

        if (expectedType !== typeof value) {
            console.error(`Invalid setting value type: ${setting}, ${value}`);
            continue;
        }

        settingsToUpdate[setting as keyof UserSettingsMap] = value;
    }

    if (!!Object.keys(settingsToUpdate).length)
        await writeUserSettings(props.user.id, settingsToUpdate as any);

    return { success: true };
}
