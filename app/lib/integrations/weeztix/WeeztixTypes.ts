// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

/**
 * Expected response for the /event/{type?} API.
 * @see https://docs.weeztix.com/api/dashboard/get-events
 */
export const kGetEventsResponse = z.array(z.object({
    guid: z.string().nonempty(),
    name: z.string().nonempty(),
    location: z.object({
        guid: z.string().nonempty(),
        name: z.string().nonempty(),
    }),
}));

/**
 * Expected response for the /event/{type?} API.
 */
export type GetEventsResponse = z.infer<typeof kGetEventsResponse>;

/**
 * Expected response when refreshing the OAuth token.
 * @see https://docs.weeztix.com/docs/introduction/authentication/refresh-token
 */
export const kRefreshTokenResponse = z.object({
    token_type: z.literal('Bearer'),
    expires_in: z.number(),
    access_token: z.string().nonempty(),
    refresh_token: z.string().nonempty(),
    refresh_token_expires_in: z.number(),
});
