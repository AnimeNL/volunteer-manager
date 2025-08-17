// Copyright 2025 Peter Beverloo. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

/**
 * Scheme definition for valid build-up / tear-down information as stored in the database.
 */
export const kAvailabilityBuildUpTearDownScheme = z.object({
    buildUpDayBefore: z.string(),
    buildUpOpening: z.string(),
    tearDownClosing: z.string(),
    tearDownDayAfter: z.string(),
});
