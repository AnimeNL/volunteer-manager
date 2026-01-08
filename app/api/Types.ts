// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import { Temporal } from '@lib/Temporal';

/**
 * Type that allows the correct API definition to be exported. From the client-side consumer point
 * of view, the request's input is given, whereas the response's output is taken. This enables Zod-
 * powered refinements and transforms to be used during type validation.
 */
export type ApiDefinition<T extends z.ZodType<any, any>> = {
    request: T['_input']['request'],
    response: T['_output']['response'],
};

/**
 * Type that retrieves the _request_ definition that the implementation needs to adhere to. This is
 * the Zod output from the actual request that was received from the client.
 */
export type ApiRequest<T extends z.ZodType<any, any>> = T['_output']['request'];

/**
 * Type that retrieves the _response_ definition that the implementation needs to adhere to. This is
 * the Zod input to the actual response that will be served to the client.
 */
export type ApiResponse<T extends z.ZodType<any, any>> = T['_input']['response'];

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
