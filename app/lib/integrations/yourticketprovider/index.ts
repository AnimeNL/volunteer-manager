// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { YourTicketProviderClient, type YourTicketProviderClientSettings } from './YourTicketProviderClient';
import { readSettings } from '@lib/Settings';

export type { YourTicketProviderClient };

/**
 * Gets an instance of the YourTicketProvider client with either the `settings` when given, or
 * default configuration loaded from the database when omitted.
 */
export async function createYourTicketProviderClient(settings?: YourTicketProviderClientSettings)
    : Promise<YourTicketProviderClient>
{
    if (!settings) {
        const configuration = await readSettings([
            // YourTicketProvider:
            'integration-ytp-api-key',
            'integration-ytp-endpoint',
            'integration-ytp-queue-endpoint',
        ]);

        for (const [ key, value ] of Object.entries(configuration)) {
            if (value !== undefined)
                continue;

            throw new Error(`Unable to instantiate the YTP client, missing setting ${key}`);
        }

        settings = {
            apiKey: configuration['integration-ytp-api-key']!,
            endpoint: configuration['integration-ytp-endpoint']!,
            queueEndpoint: configuration['integration-ytp-queue-endpoint']!,
        };
    }

    return new YourTicketProviderClient(settings);
}
