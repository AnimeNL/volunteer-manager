// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { ClientSettings } from './Client';
import { Client } from './Client';
import { createGoogleClient } from '../google';
import { readSettings } from '@lib/Settings';

/**
 * Gets an instance of the Google Gen AI client. The |settings| may optionally contain one more of
 * the accepted settings, where all other settings will be read from the database.
 */
export async function createAiClient(partialSettings?: Partial<ClientSettings>) {
    const configuration = await readSettings([
        // GoogleClient configuration:
        'integration-google-apikey',
        'integration-google-credentials',
        'integration-google-location',
        'integration-google-project-id',

        // Gen AI SDK configuration:
        'ai-setting-backend',
        'ai-setting-candidate-count',
        'ai-setting-gemini-api-key',
        'ai-setting-image-model',
        'ai-setting-temperature',
        'ai-setting-text-model',
        'ai-setting-top-k',
        'ai-setting-top-p',
    ]);

    for (const [ key, value ] of Object.entries(configuration)) {
        if (value !== undefined)
            continue;

        throw new Error(`Unable to instantiate the Gen AI SDK client, missing setting ${key}`);
    }

    return new Client({
        apiKey: configuration['ai-setting-gemini-api-key']!,
        candidateCount: configuration['ai-setting-candidate-count']!,
        googleClient: await createGoogleClient({
            apiKey: configuration['integration-google-apikey']!,
            credentials: configuration['integration-google-credentials']!,
            location: configuration['integration-google-location']!,
            projectId: configuration['integration-google-project-id']!,
        }),
        models: {
            image: configuration['ai-setting-image-model']!,
            text: configuration['ai-setting-text-model']!,
        },
        quality: {
            temperature: configuration['ai-setting-temperature'],
            topK: configuration['ai-setting-top-k'],
            topP: configuration['ai-setting-top-p'],
        },
        vertexAi: configuration['ai-setting-backend'] === 'vertexai',
        ...partialSettings,
    });
}
