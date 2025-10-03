// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { NextRequest } from 'next/server';
import { forbidden } from 'next/navigation';
import { z } from 'zod/v4';

import type { ApiDefinition, ApiRequest, ApiResponse } from '../Types';
import { type ActionProps, executeAction } from '../Action';
import db, { tErrorLogs } from '@lib/database';

/**
 * Interface definition for the Error API, exposed through /api/error.
 */
const kErrorDefinition = z.object({
    request: z.object({
        /**
         * Request path on which the error was thrown.
         */
        pathname: z.string(),

        /**
         * Name of the exception that was thrown.
         * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/name
         */
        name: z.string(),

        /**
         * Message associated with the error.
         * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/message
         */
        message: z.string(),

        /**
         * The error's stack message, when made available. May be filtered.
         * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/stack
         */
        stack: z.string().optional(),

        /**
         * Digest of the error message, injected by Next.js.
         */
        digest: z.string().optional(),
    }),
    response: z.object({ /* no response */ }),
});

export type ErrorDefinition = ApiDefinition<typeof kErrorDefinition>;

type Request = ApiRequest<typeof kErrorDefinition>;
type Response = ApiResponse<typeof kErrorDefinition>;

/**
 * API that will be called by clients who have seen an unrecoverable runtime error, for example
 * because of a JavaScript issue. The instance will be logged to the database.
 */
async function error(request: Request, props: ActionProps): Promise<Response> {
    if (!props.ip)
        forbidden();

    const dbInstance = db;
    await dbInstance.insertInto(tErrorLogs)
        .set({
            errorDate: dbInstance.currentZonedDateTime(),
            errorUserId: props.user?.id,
            errorIpAddress: props.ip,
            errorOrigin: props.origin,
            errorPathname: request.pathname,
            errorName: request.name,
            errorMessage: request.message,
            errorStack: request.stack,
            errorDigest: request.digest,
        })
        .executeInsert();

    return { };
}

// The /api/error route only provides a single API - call it straight away.
export const POST = (request: NextRequest) => executeAction(request, kErrorDefinition, error);
