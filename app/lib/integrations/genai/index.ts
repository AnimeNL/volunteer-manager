// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { type ClientSettings, Client } from './Client';
import { readSettings } from '@lib/Settings';

/**
 * Gets an instance of the Google Gen AI client. The |settings| may optionally contain one more of
 * the accepted settings, where all other settings will be read from the database.
 */
export async function createAiClient(partialSettings?: Partial<ClientSettings>) {
    const configuration = await readSettings([
        'ai-setting-gemini-api-key',
        'ai-setting-gemini-api',
        'ai-setting-image-model',
        'ai-setting-temperature',
        'ai-setting-text-model-high',
        'ai-setting-text-model-low',
        'ai-setting-text-model-medium',
        'ai-setting-thinking-level',
        'ai-setting-top-p',
        'integration-google-credentials',
        'integration-google-location',
        'integration-google-project-id',
    ]);

    for (const [ key, value ] of Object.entries(configuration)) {
        if (value !== undefined)
            continue;

        throw new Error(`Unable to instantiate the Gen AI SDK client, missing setting ${key}`);
    }

    return new Client({
        api: configuration['ai-setting-gemini-api']!,
        apiKey: configuration['ai-setting-gemini-api-key']!,
        googleCloud: {
            credentials: configuration['integration-google-credentials']!,
            location: configuration['integration-google-location'],
            project: configuration['integration-google-project-id']!,
        },
        models: {
            image: configuration['ai-setting-image-model']!,
            text: {
                low: configuration['ai-setting-text-model-low']!,
                medium: configuration['ai-setting-text-model-medium']!,
                high: configuration['ai-setting-text-model-high']!,
            },
        },
        quality: {
            temperature: configuration['ai-setting-temperature'],
            topP: configuration['ai-setting-top-p'],
            thinkingLevel: configuration['ai-setting-thinking-level'],
        },
        ...partialSettings,
    });
}
