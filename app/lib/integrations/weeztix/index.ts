// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { WeeztixClient, type WeeztixClientSettings } from './WeeztixClient';
import { readSettings } from '@lib/Settings';

export type { WeeztixClient };

/**
 * Gets an instance of the WeeztixClient client with either the `settings` when given, or default
 * configuration loaded from the database when omitted.
 */
export async function createWeeztixClient(settings?: WeeztixClientSettings)
    : Promise<WeeztixClient>
{
    if (!settings) {
        const configuration = await readSettings([
            'integration-weeztix-access-token',
            'integration-weeztix-access-token-expiration',
            'integration-weeztix-client-id',
            'integration-weeztix-client-secret',
            'integration-weeztix-refresh-token',
            'integration-weeztix-refresh-token-expiration',
        ]);

        for (const [ key, value ] of Object.entries(configuration)) {
            if (value !== undefined)
                continue;

            throw new Error(`Unable to instantiate the Weeztix client, missing setting ${key}`);
        }

        settings = {
            accessToken: {
                token: configuration['integration-weeztix-access-token']!,
                expiration: Temporal.Instant.fromEpochMilliseconds(
                    configuration['integration-weeztix-access-token-expiration']!),
            },
            refreshToken: {
                token: configuration['integration-weeztix-refresh-token']!,
                expiration: Temporal.Instant.fromEpochMilliseconds(
                    configuration['integration-weeztix-refresh-token-expiration']!),
            },
            clientId: configuration['integration-weeztix-client-id']!,
            clientSecret: configuration['integration-weeztix-client-secret']!,
        };
    }

    return new WeeztixClient(settings);
}
