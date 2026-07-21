// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { AiSupportedModel } from './integrations/genai/Models';
import type { GeminiApi, TextGenerationComplexity, TextGenerationThinkingLevel } from './integrations/genai/Client';
import type { TwilioRegion } from './integrations/twilio/TwilioTypes';
import { Cache } from '@lib/cache/Cache';
import db, { tSettings } from '@lib/database';

/**
 * Represents the settings that can be stored and retrieved in the Volunteer Manager. These are all
 * stored in the database, but typing is done exclusively client-side.
 */
export type Settings = {
    // ---------------------------------------------------------------------------------------------
    // Display settings
    // ---------------------------------------------------------------------------------------------

    'display-check-in-rate-help-requested-seconds': number;
    'display-check-in-rate-seconds': number;
    'display-confirm-volume-change': boolean;
    'display-dev-environment-link': string;
    'display-max-time-since-check-in-days': number;
    'display-request-advice': boolean;
    'display-request-help': boolean;
    'display-time-offset-seconds': number;

    // ---------------------------------------------------------------------------------------------
    // Event settings
    // ---------------------------------------------------------------------------------------------

    // Availability:
    'availability-max-event-duration-minutes': number;
    'availability-time-step-minutes': number;

    // Communication:
    'communication-name-suffix': string;

    // Retention:
    'retention-number-of-events-to-consider': number;
    'retention-whatsapp-message': string;

    // Schedule:
    'schedule-day-view-start-time': string;
    'schedule-day-view-end-time': string;
    'schedule-event-view-start-hours': number;
    'schedule-event-view-end-hours': number;
    'schedule-recent-shift-count': number;
    'schedule-time-step-minutes': number;
    'schedule-vendor-first-aid-card': boolean;
    'schedule-vendor-security-card': boolean;

    // Vendors:
    'vendor-first-aid-email-address': string;
    'vendor-first-aid-roles': string;
    'vendor-security-roles': string;

    // ---------------------------------------------------------------------------------------------
    // Artificial Intelligence
    // ---------------------------------------------------------------------------------------------

    // Communication (example messages):
    'ai-example-messages': string[];  // can be overridden by a user setting

    // Communication (prompts):
    'ai-communication-personality-prompt': string;
    'ai-communication-system-prompt': string;
    'ai-communication-type-application-approved': string;
    'ai-communication-type-application-rejected': string;
    'ai-communication-type-event-dates-announced': string;
    'ai-communication-type-event-hotels-announced': string;
    'ai-communication-type-event-trainings-announced': string;
    'ai-communication-type-hotel-confirmation': string;
    'ai-communication-type-participation-cancelled': string;
    'ai-communication-type-participation-reinstated': string;
    'ai-communication-type-participation-reminder': string;
    'ai-communication-type-team-change': string;

    // Del a Rie Advies:
    'ai-nardo-personalised-advice': string;

    // Duty Book summaries:
    'ai-duty-book-summary-prompt': string;
    'ai-duty-book-summary-prompt-complexity': TextGenerationComplexity;

    // Incident reports:
    'ai-incident-summary-prompt': string;
    'ai-incident-summary-prompt-complexity': TextGenerationComplexity;

    // Personality description:
    'ai-personality-description-prompt': string;
    'ai-personality-description-prompt-complexity': TextGenerationComplexity;

    // Settings:
    'ai-setting-gemini-api-key': string;
    'ai-setting-gemini-api': GeminiApi;
    'ai-setting-image-model': AiSupportedModel;
    'ai-setting-text-model-high': AiSupportedModel;
    'ai-setting-text-model-low': AiSupportedModel;
    'ai-setting-text-model-medium': AiSupportedModel;
    'ai-setting-thinking-level': TextGenerationThinkingLevel;
    'ai-setting-temperature': number;
    'ai-setting-top-p': number;

    // ---------------------------------------------------------------------------------------------
    // Integration settings
    // ---------------------------------------------------------------------------------------------

    // AnimeCon:
    'integration-animecon-api-endpoint': string;
    'integration-animecon-auth-endpoint': string;
    'integration-animecon-client-id': string;
    'integration-animecon-client-secret': string;
    'integration-animecon-username': string;
    'integration-animecon-password': string;
    'integration-animecon-scopes': string;

    // E-mail:
    'integration-email-smtp-hostname': string;
    'integration-email-smtp-port': number;
    'integration-email-smtp-username': string;
    'integration-email-smtp-password': string;

    // Google:
    'integration-google-apikey': string;
    'integration-google-credentials': string;
    'integration-google-location': string;
    'integration-google-project-id': string;

    // Twilio:
    'integration-twilio-account-auth-token': string;
    'integration-twilio-account-sid': string;
    'integration-twilio-messaging-sid-sms': string;
    'integration-twilio-messaging-sid-whatsapp': string;
    'integration-twilio-region': TwilioRegion;

    // Weeztix:
    'integration-weeztix-access-token': string;
    'integration-weeztix-access-token-expiration': number;
    'integration-weeztix-client-id': string;
    'integration-weeztix-client-secret': string;
    'integration-weeztix-redirect-url': string;
    'integration-weeztix-refresh-token': string;
    'integration-weeztix-refresh-token-expiration': number;

    // YourTicketProvider:
    'integration-ytp-api-key': string;
    'integration-ytp-endpoint': string;

    // ---------------------------------------------------------------------------------------------
    // Schedule settings:
    // ---------------------------------------------------------------------------------------------

    'schedule-activity-list-limit': number;
    'schedule-check-in-rate-seconds': number;
    'schedule-del-a-rie-advies': boolean;
    'schedule-del-a-rie-advies-genai': boolean;
    'schedule-del-a-rie-advies-time-limit': number;
    'schedule-logical-days': boolean;
    'schedule-sales-product-panel': boolean;
    'schedule-sales-sold-out': boolean;
    'schedule-search-candidate-fuzziness': number;
    'schedule-search-candidate-minimum-score': number;
    'schedule-search-result-limit': number;
    'schedule-sort-past-days-last': boolean;
    'schedule-sort-past-events-last': boolean;
    'schedule-time-offset-seconds': number;

    // ---------------------------------------------------------------------------------------------
    // UserSettings defaults
    // ---------------------------------------------------------------------------------------------

    // None.
};

/**
 * Type containing all setting names known to the system.
 */
export type Setting = keyof Settings;

/**
 * Reads the setting with the given `setting`, or `undefined` when it cannot be loaded. This
 * function will end up issuing a database call.
 */
export async function readSetting<T extends keyof Settings>(setting: T)
    : Promise<Settings[T] | undefined>
{
    return (await readSettings([ setting ]))[setting];
}

/**
 * Reads the settings whose names are included in the given `settings`. An object will be returned
 * with the setting values, or `undefined` when they cannot be loaded. This function will end up
 * issuing a database call unless all `settings` are cached.
 */
export async function readSettings<T extends keyof Settings>(settings: T[])
    : Promise<{ [k in T]: Settings[k] | undefined }>
{
    const cache = Cache.getInstance('Settings');
    const result: { [k in T]: Settings[k] | undefined } = { /* empty */ } as any;

    const uncachedSettings: T[] = [];

    // First attempt to read the settings from the cache. The cache will eventually saturate after
    // which all subsequent settings can be read from the memory cache.
    for (const setting of settings) {
        const cached = cache.get(setting);
        if (cached && typeof cached === 'object')
            result[setting] = cached.value as any;
        else
            uncachedSettings.push(setting);
    }

    // If all settings were successfully obtained from the cache, bail out now as the requested
    // information can be made available. Otherwise we fetch the information from the database.
    if (!uncachedSettings.length)
        return result;

    const storedValues = await db.selectFrom(tSettings)
        .where(tSettings.settingName.in(uncachedSettings))
        .select({
            name: tSettings.settingName,
            value: tSettings.settingValue,
        })
        .executeSelectMany();

    const existingSettings = new Set<string>();
    for (const { name, value } of storedValues) {
        existingSettings.add(name);

        const parsedValue = JSON.parse(value);

        result[name as T] = parsedValue;
        cache.set(name, { value: parsedValue });
    }

    for (const setting of uncachedSettings) {
        if (existingSettings.has(setting))
            continue;

        result[setting] = undefined;
        cache.set(setting, { value: undefined });
    }

    return result;
}

/**
 * Writes the setting with the given `setting` to the database, to be associated with the given
 * `value` (which may be `undefined`). This function will end up issuing a database call.
 */
export async function writeSetting<T extends keyof Settings>(setting: T, value?: Settings[T])
    : Promise<void>
{
    await writeSettings({ [setting]: value } as any);
}

/**
 * Writes the given `settings` to the database. Each key in `settings` must be a valid setting with
 * the appropriate type, or `undefined`. This function works by deleting all keys from the database
 * and then creating new rows for the settings with values, all within a transaction.
 */
export async function writeSettings<T extends keyof Settings>(
    settings: { [k in T]: Settings[k] | undefined }) : Promise<void>
{
    const dbInstance = db;
    await dbInstance.transaction(async () => {
        const keysToDelete: T[] = [];
        const keysToInsert: { settingName: string, settingValue: string }[] = [];

        for (const [ setting, value ] of Object.entries(settings)) {
            keysToDelete.push(setting as T);

            if (typeof value !== 'undefined')
                keysToInsert.push({ settingName: setting, settingValue: JSON.stringify(value) });
        }

        // Delete stored settings that no longer should have a value.
        if (keysToDelete.length) {
            await dbInstance.deleteFrom(tSettings)
                .where(tSettings.settingName.in(keysToDelete))
                .executeDelete(/* min= */ 0, /* max= */ keysToDelete.length);
        }

        // Insert new rows for stored settings that do have a value.
        if (keysToInsert.length) {
            await dbInstance.insertInto(tSettings)
                .values(keysToInsert)
                .onConflictDoUpdateSet({ settingValue: tSettings.settingValue })
                .executeInsert();
        }
    });

    const cache = Cache.getInstance('Settings');

    for (const [ setting, value ] of Object.entries(settings))
        cache.set(setting, { value });
}

