// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

/**
 * Zod type validating that the input conforms to `Temporal.PlainDate` constraints.
 */
export const kTemporalPlainDate =
    z.string().transform((value, context) => {
        try {
            return Temporal.PlainDate.from(value);
        } catch (error: any) {
            context.addIssue({
                code: 'custom',
                message: `Only plain dates are accepted (YYYY-MM-DD), got "${value}"`,
                _error: error,
            });
        }

        return z.NEVER;
    });

/**
 * Zod type validating that the input conforms to `Temporal.PlainTime` constraints.
 */
export const kTemporalPlainTime =
    z.string().transform((value, context) => {
        try {
            return Temporal.PlainTime.from(value);
        } catch (error: any) {
            context.addIssue({
                code: 'custom',
                message: `Only plain times are accepted (HH:mm:ss), got "${value}"`,
                _error: error,
            });
        }

        return z.NEVER;
    });

/**
 * Zod type validating that the input conforms to `Temporal.ZonedDateTime` constraints.
 */
export const kTemporalZonedDateTime =
    z.string().transform((value, context) => {
        try {
            return Temporal.Instant.from(value).toZonedDateTimeISO('UTC');
        } catch (error: any) {
            context.addIssue({
                code: 'custom',
                message:
                    `Only zoned date + time are accepted (YYYY-MM-DD HH:mm:ss Z), got "${value}"`,
                _error: error,
            });
        }

        return z.NEVER;
    });
