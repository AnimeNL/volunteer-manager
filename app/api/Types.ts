// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { z } from 'zod/v4';

import { kTemporalPlainDate, kTemporalPlainTime, kTemporalZonedDateTime } from '@app/admin/lib/ZodTransformers';
export { kTemporalPlainDate, kTemporalPlainTime, kTemporalZonedDateTime };

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
