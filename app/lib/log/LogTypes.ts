// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

/**
 * Zod schema representing valid types for usage with the LogBuilder.
 */
export const kLogPayloadAllowedTypes = z.union([
    z.string(),
    z.array(z.string()),
    z.number(),
    z.array(z.number()),
    z.boolean(),
    z.array(z.boolean()),
]);

/**
 * Types that are allowed to be used in the `record` and `withDiff` builder methods.
 */
export type LogPayloadAllowedTypes = z.infer<typeof kLogPayloadAllowedTypes>;

/**
 * Zod schema representing the allowed payload to be stored with a log record.
 */
export const kLogPayloadRecord = z.record(z.string(), kLogPayloadAllowedTypes);

/**
 * Zod schema representing valid before/after pairs in difference determination.
 */
const kLogDifferenceStrictPairSchema = z.union([
    z.object({ before: z.string(), after: z.string() }),
    z.object({ before: z.array(z.string()), after: z.array(z.string()) }),
    z.object({ before: z.number(), after: z.number() }),
    z.object({ before: z.array(z.number()), after: z.array(z.number()) }),
    z.object({ before: z.boolean(), after: z.boolean() }),
]);

/**
 * Zod schema representing the differential information given to a log record.
 */
export const kLogDifferencesSchema = z.record(z.string(), kLogDifferenceStrictPairSchema);

/**
 * Structure through which differences can be included in the log entry.
 */
export type LogDifferences = z.infer<typeof kLogDifferencesSchema>;
