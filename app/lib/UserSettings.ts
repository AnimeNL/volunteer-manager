// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Cache } from '@lib/cache';
import { readSettings, type Setting } from './Settings';
import db, { tUsersSettings } from '@lib/database';

/**
 * Represents the settings that can be stored and retrieved in the Volunteer Manager that are keyed
 * on a per user basis. These are complementary to regular settings, and regular settings can be
 * used to configure default values for these.
 */
export type UserSettingsMap = {
    // ---------------------------------------------------------------------------------------------
    // Admin settings
    // ---------------------------------------------------------------------------------------------

    'admin-theme-color': string;

    'user-admin-event-finance-configuration': boolean;
    'user-admin-experimental-layout': boolean;
    'user-admin-knowledge-expand-categories': boolean;
    'user-admin-menu-state': string;
    'user-admin-schedule-date': string;
    'user-admin-schedule-expand-sections': string;
    'user-admin-schedule-expand-history': boolean;
    'user-admin-schedule-expand-warnings': boolean;
    'user-admin-schedule-highlight-shifts': string;
    'user-admin-schedule-inclusive-shifts': boolean;
    'user-admin-shifts-display-other-teams': boolean;
    'user-admin-volunteers-expand-notes': boolean;
    'user-admin-volunteers-expand-shifts': boolean;

    // ---------------------------------------------------------------------------------------------
    // AI settings
    // ---------------------------------------------------------------------------------------------

    'ai-communication-personality-prompt': string;  // overrides a regular setting
    'ai-example-messages': string[];  // overrides a regular setting

    'user-ai-example-messages': string;
    'user-ai-example-messages-promo-time': number;
};

/**
 * Type containing all setting names known to the system.
 */
export type UserSetting = keyof UserSettingsMap;

/**
 * Reads the user setting with the given `setting`, or `undefined` when it cannot be loaded and no
 * default has been configured. This function will end up issuing a database call.
 */
export async function readUserSetting<T extends keyof UserSettingsMap>(userId: number, setting: T)
    : Promise<UserSettingsMap[T] | undefined>
{
    return (await readUserSettings(userId, [ setting ]))[setting];
}

/**
 * Reads the settings whose names are included in the given `settings` for the user identified by
 * the given `userId`. An object will be returned with the setting values, or `undefined` when they
 * cannot be loaded or have no defaults. This function will end up issuing a database call.
 */
export async function readUserSettings<T extends keyof UserSettingsMap>(
    userId: number, settings: T[], disableFallback?: boolean)
        : Promise<{ [k in T]: UserSettingsMap[k] | undefined }>
{
    const userSettingsCache = Cache.getInstance('UserSettings');
    const userSettings = await userSettingsCache.getOrInsert(userId, async userId => {
        const userSettings = await db.selectFrom(tUsersSettings)
            .where(tUsersSettings.userId.equals(userId))
            .select({
                key: tUsersSettings.settingName,
                value: tUsersSettings.settingValue,
            })
            .executeSelectMany();

        return Object.fromEntries(userSettings.map(({ key, value }) => [
            key, value ? JSON.parse(value) : undefined ]));
    });

    const missingSettingsForFallback: Setting[] = [ /* none yet */ ];

    const result: { [k in T]: UserSettingsMap[k] | undefined } = { /* empty */ } as any;
    for (const setting of settings) {
        if (userSettings && Object.hasOwn(userSettings, setting)) {
            result[setting] = userSettings[setting];
        } else if (!disableFallback) {
            missingSettingsForFallback.push(setting as Setting);
        } else {
            result[setting] = undefined;
        }
    }

    if (!!missingSettingsForFallback.length) {
        const values = await readSettings(missingSettingsForFallback);
        for (const [ key, value ] of Object.entries(values))
            result[key as T] = value as any;
    }

    return result;
}

/**
 * Writes the setting with the given `setting` to the database for the given `userId`, to be
 * associated with the given `value` (which may be `undefined`). This function will end up issuing
 * a database call.
 */
export async function writeUserSetting<T extends keyof UserSettingsMap>(
    userId: number, setting: T, value?: UserSettingsMap[T]): Promise<void>
{
    await writeUserSettings(userId, { [setting]: value } as any);
}

/**
 * Writes the given `settings` to the database. Each key in `settings` must be a valid setting with
 * the appropriate type, or `undefined`. This function works by deleting all keys from the database
 * and then creating new rows for the settings with values, all within a transaction.
 */
export async function writeUserSettings<T extends keyof UserSettingsMap>(
    userId: number, settings: { [k in T]: UserSettingsMap[k] | undefined }) : Promise<void>
{
    const userSettingsCache = Cache.getInstance('UserSettings');
    const userSettings = userSettingsCache.get(userId);

    const dbInstance = db;
    await dbInstance.transaction(async () => {
        for (const [ setting, value ] of Object.entries(settings)) {
            if (value === undefined || value === null) {
                if (!!userSettings)
                    delete userSettings[setting];

                await dbInstance.deleteFrom(tUsersSettings)
                    .where(tUsersSettings.userId.equals(userId))
                        .and(tUsersSettings.settingName.equals(setting))
                    .executeDelete();

            } else {
                if (!!userSettings)
                    userSettings[setting] = value;

                const settingValue = JSON.stringify(value);

                await dbInstance.insertInto(tUsersSettings)
                    .set({
                        userId,
                        settingName: setting,
                        settingValue,
                    })
                    .onConflictDoUpdateSet({ settingValue })
                    .executeInsert();
            }
        }
    });
}
