// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import { Cache } from '@lib/cache';

/**
 * Zod schema indicating the information that can be retrieved about an IP address.
 *
 * @see https://www.ip2location.com/documentation/ip2location-database-db11
 */
const kLocationSchema = z.object({
    country_code: z.string(),
    country_name: z.string(),
    region_name: z.string().optional(),
    city_name: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    zip_code: z.string().optional(),
    time_zone: z.string().optional(),
});

/**
 * Executes an ip2location query for the given `ipAddress`, which may be either IPv4 or IPv6.
 * 
 * This function is backed by a simple wrapper server backed by a ip2location.com database that
 * takes two HTTP parameters: `token` and `ip`. Both the endpoint of the server and the used token
 * are derived from two environment variables:
 *
 * * `APP_IP2LOCATION_ENDPOINT` (ex: https://my-location-db.host.com/)
 * * `APP_IP2LOCATION_TOKEN` (ex: MySecretToken)
 *
 * This function fails gracefully when these variables are not set, or when the service is for other
 * reasons unavailable. Results will be locally cached with a TTL of exactly a day.
 *
 * @see https://hub.docker.com/r/ip2location/mysql
 * @see https://www.ip2location.com/database/lite
 */
export async function ip2location(ipAddress: string)
    : Promise<z.infer<typeof kLocationSchema> | undefined>
{
    const endpoint = process.env.APP_IP2LOCATION_ENDPOINT;
    const token = process.env.APP_IP2LOCATION_TOKEN;

    if (!endpoint || !token)
        return undefined;

    return await Cache.getInstance('IP2Location').getOrInsert(ipAddress, async ipAddress => {
        const query = new URLSearchParams();
        query.set('token', token);
        query.set('ip', ipAddress);

        const requestUrl = `${endpoint}?${query.toString()}`;
        try {
            const response = await fetch(requestUrl);
            if (!response.ok)
                throw new Error(`The server responded with HTTP ${response.status} status code.`);

            const responseJsonUnverified = await response.json();
            const responseJson = kLocationSchema.parse(responseJsonUnverified?.result);

            return responseJson;

        } catch (error: any) {
            console.warn(`Unable to fetch ip2location information:`, error);
            return null;
        }
    }) ?? undefined;
}
