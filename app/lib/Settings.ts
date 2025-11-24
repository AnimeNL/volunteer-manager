// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { TwilioRegion } from './integrations/twilio/TwilioTypes';
import type { VertexSupportedModels } from './integrations/vertexai/VertexSupportedModels';
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

    // Applications:
    'application-publish-on-move': boolean;

    // Availability:
    'availability-max-event-duration-minutes': number;
    'availability-time-step-minutes': number;

    // Program:
    'program-event-sales-relative': boolean;

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

    // Communication:
    'ai-communication-system-prompt': string;
    'ai-communication-type-hotel-confirmation': string;
    'ai-communication-type-retention': string;
    'ai-example-messages': string;

    // Settings:
    'ai-setting-backend': 'gemini' | 'vertexai';
    'ai-setting-gemini-api-key': string;
    'ai-setting-image-model': VertexSupportedModels;
    'ai-setting-text-model': VertexSupportedModels;
    'ai-setting-candidate-count': number;
    'ai-setting-temperature': number;
    'ai-setting-top-k': number;
    'ai-setting-top-p': number;

    // Personality:
    'gen-ai-personality': string;
    'gen-ai-system-instruction': string;

    // Intentions:
    'gen-ai-intention-approve-volunteer': string;
    'gen-ai-intention-cancel-participation': string;
    'gen-ai-intention-change-team': string;
    'gen-ai-intention-reinstate-participation': string;
    'gen-ai-intention-reject-volunteer': string;
    'gen-ai-intention-remind-participation': string;

    // Prompts:
    'gen-ai-prompt-del-a-rie-advies': string;
    'gen-ai-prompt-financial-insights': string;

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

    // Google Vertex AI:
    'integration-vertex-model': VertexSupportedModels;
    'integration-vertex-temperature': number;
    'integration-vertex-token-limit': number;
    'integration-vertex-top-k': number;
    'integration-vertex-top-p': number;

    // Twilio:
    'integration-twilio-account-auth-token': string;
    'integration-twilio-account-sid': string;
    'integration-twilio-messaging-sid-sms': string;
    'integration-twilio-messaging-sid-whatsapp': string;
    'integration-twilio-region': TwilioRegion;

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
    'schedule-favourite-events': boolean;
    'schedule-knowledge-base': boolean;
    'schedule-knowledge-base-search': boolean;
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

    // No user settings exist yet.
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
 * issuing a database call.
 */
export async function readSettings<T extends keyof Settings>(settings: T[])
    : Promise<{ [k in T]: Settings[k] | undefined }>
{
    const storedValues = await db.selectFrom(tSettings)
        .where(tSettings.settingName.in(settings))
        .select({
            name: tSettings.settingName,
            value: tSettings.settingValue,
        })
        .executeSelectMany();

    const result: { [k in T]: Settings[k] | undefined } = { /* empty */ } as any;
    for (const { name, value } of storedValues)
        result[name as keyof typeof result] = JSON.parse(value);

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
                .executeInsert();
        }
    });
}
