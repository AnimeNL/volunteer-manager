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
