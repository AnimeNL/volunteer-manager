// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import db, { tSettings, tUsersSettings } from '@lib/database';

/**
 * Represents the settings that can be stored and retrieved in the Volunteer Manager that are keyed
 * on a per user basis. These are complementary to regular settings, and regular settings can be
 * used to configure default values for these.
 */
export type UserSettingsMap = {
    // ---------------------------------------------------------------------------------------------
    // Admin settings
    // ---------------------------------------------------------------------------------------------

    'user-admin-event-finance-configuration': boolean;
    'user-admin-experimental-dark-mode': boolean;
    'user-admin-experimental-responsive': boolean;
    'user-admin-knowledge-expand-categories': boolean;
    'user-admin-schedule-date': string;
    'user-admin-schedule-expand-sections': string;
    'user-admin-schedule-expand-history': boolean;
    'user-admin-schedule-expand-warnings': boolean;
    'user-admin-schedule-highlight-shifts': string;
    'user-admin-schedule-inclusive-shifts': boolean;
    'user-admin-shifts-display-other-teams': boolean;
    'user-admin-shifts-expand-shifts': boolean;
    'user-admin-volunteers-columns-filter': string;
    'user-admin-volunteers-columns-hidden': string;
    'user-admin-volunteers-expand-notes': boolean;
    'user-admin-volunteers-expand-shifts': boolean;

    // ---------------------------------------------------------------------------------------------
    // AI settings
    // ---------------------------------------------------------------------------------------------

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
    const usersSettingsJoin = tUsersSettings.forUseInLeftJoin();
    const storedValues = await db.selectFrom(tSettings)
        .leftJoin(usersSettingsJoin)
            .on(usersSettingsJoin.settingName.equals(tSettings.settingName))
            .and(usersSettingsJoin.userId.equals(userId))
        .where(tSettings.settingName.in(settings))
        .select({
            name: tSettings.settingName,
            value: usersSettingsJoin.settingValue.valueWhenNull(
                tSettings.settingValue.onlyWhenOrNull(disableFallback !== true)),
        })
        .executeSelectMany();

    const result: { [k in T]: UserSettingsMap[k] | undefined } = { /* empty */ } as any;
    for (const { name, value } of storedValues)
        result[name as keyof typeof result] = value ? JSON.parse(value) : undefined;

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
    const dbInstance = db;
    await dbInstance.transaction(async () => {
        for (const [ setting, value ] of Object.entries(settings)) {
            if (value === undefined || value === null) {
                await dbInstance.deleteFrom(tUsersSettings)
                    .where(tUsersSettings.userId.equals(userId))
                        .and(tUsersSettings.settingName.equals(setting))
                    .executeDelete();

            } else {
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
