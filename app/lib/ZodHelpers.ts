// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

/**
 * Helper to create a Zod transformer that parses a string using a `Temporal` factory, reporting
 * a custom validation issue when parsing fails.
 */
function createTemporalTransformer<T>(
    parse: (value: string) => T,
    describeError: (value: string) => string)
{
    return z.string().transform((value, context) => {
        try {
            return parse(value);
        } catch (error: any) {
            context.addIssue({
                code: 'custom',
                message: describeError(value),
                _error: error,
            });
        }

        return z.NEVER;
    });
}

/**
 * Zod type validating that the input conforms to `Temporal.PlainDate` constraints.
 */
export const kTemporalPlainDate = createTemporalTransformer(
    value => Temporal.PlainDate.from(value),
    value => `Only plain dates are accepted (YYYY-MM-DD), got "${value}"`);

/**
 * Zod type validating that the input conforms to `Temporal.PlainDateTime` constraints.
 */
export const kTemporalPlainDateTime = createTemporalTransformer(
    value => Temporal.PlainDateTime.from(value),
    value => `Only plain date-times are accepted (YYYY-MM-DDTHH:mm), got "${value}"`);

/**
 * Zod type validating that the input conforms to `Temporal.PlainTime` constraints.
 */
export const kTemporalPlainTime = createTemporalTransformer(
    value => Temporal.PlainTime.from(value),
    value => `Only plain times are accepted (HH:mm:ss), got "${value}"`);

/**
 * Zod type validating that the input conforms to `Temporal.ZonedDateTime` constraints.
 */
export const kTemporalZonedDateTime = createTemporalTransformer(
    value => Temporal.Instant.from(value).toZonedDateTimeISO('UTC'),
    value => `Only zoned date + time are accepted (YYYY-MM-DD HH:mm:ss Z), got "${value}"`);
