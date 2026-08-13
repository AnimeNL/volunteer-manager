// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

/**
 * Zod type definition for the `shift_demand` column value stored in the `shifts` table.
 */
export const kShiftDemand = z.array(z.object({
    /**
     * Moment at which this demand entry starts.
     */
    start: z.string().datetime({ offset: true }),

    /**
     * Moment at which this demand entry ends.
     */
    end: z.string().datetime({ offset: true }),

    /**
     * Number of volunteers who are expected to participate during this entry.
     */
    volunteers: z.number().min(1),
}));
