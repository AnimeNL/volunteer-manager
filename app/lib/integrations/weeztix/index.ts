// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { WeeztixClient, type WeeztixClientSettings } from './WeeztixClient';
import { readSettings } from '@lib/Settings';

export type { WeeztixClient };

/**
 * Gets an instance of the WeeztixClient client with either the `settings` when given, or default
 * configuration loaded from the database when omitted.
 */
export async function createWeeztixClient(optionalMetadataFields?: boolean)
    : Promise<WeeztixClient>
{
    const configuration = await readSettings([
        'integration-weeztix-access-token',
        'integration-weeztix-access-token-expiration',
        'integration-weeztix-client-id',
        'integration-weeztix-client-secret',
        'integration-weeztix-company-id',
        'integration-weeztix-meta-first-name-id',
        'integration-weeztix-meta-function-id',
        'integration-weeztix-meta-last-name-id',
        'integration-weeztix-meta-nickname-id',
        'integration-weeztix-meta-organisation-id',
        'integration-weeztix-refresh-token',
        'integration-weeztix-refresh-token-expiration',
    ]);

    for (const [ key, value ] of Object.entries(configuration)) {
        if (value !== undefined)
            continue;

        if (!!optionalMetadataFields && (key.includes('company') || key.includes('meta')))
            continue;

        throw new Error(`Unable to instantiate the Weeztix client, missing setting ${key}`);
    }

    return new WeeztixClient({
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
        companyId: configuration['integration-weeztix-company-id']!,
        meta: {
            firstName: configuration['integration-weeztix-meta-first-name-id']!,
            function: configuration['integration-weeztix-meta-function-id']!,
            lastName: configuration['integration-weeztix-meta-last-name-id']!,
            nickname: configuration['integration-weeztix-meta-nickname-id']!,
            organisation: configuration['integration-weeztix-meta-organisation-id']!,
        },
    });
}

/**
 * Computes the total capacity of a Weeztix ticket or product type from its `available` stock,
 * `sold` count, and `status`. In Weeztix, an `available` stock of `0` represents unlimited capacity
 * unless the ticket's `status` is `'sold_out'`.
 */
export function computeWeeztixTicketCapacity(
    available: number, sold: number, status: string): number | undefined
{
    if (available > 0)
        return available + sold;

    if (status === 'sold_out' && sold > 0)
        return sold;

    return undefined;
}
