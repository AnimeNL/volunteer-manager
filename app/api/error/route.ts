// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { NextRequest } from 'next/server';
import { forbidden } from 'next/navigation';
import { z } from 'zod/v4';

import type { ApiDefinition, ApiRequest, ApiResponse } from '../Types';
import { type ActionProps, executeAction } from '../Action';

import { kLogSeverity, RecordErrorLog } from '@lib/Log';
import { kErrorSource, type LogSeverity } from '@lib/database/Types';

/**
 * HTTP Status codes for which this API route may be invoked.
 */
const kStatusCodes: { [k: number]: string } = {
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
};

/**
 * Interface definition for the Error API, exposed through /api/error.
 */
const kErrorDefinition = z.object({
    request: z.object({
        /**
         * Request path on which the error was thrown.
         */
        pathname: z.string(),
    }).and(z.object({
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

    }).or(z.object({
        /**
         * Status code for which the error page was shown.
         */
        statusCode: z.number(),

    }))),
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

    let severity: LogSeverity = kLogSeverity.Info;
    let error: {
        name: string;
        message: string;
        stack?: string;
    };

    if ('statusCode' in request) {
        if (!!props.user)
            severity = kLogSeverity.Error;

        error = {
            name: kStatusCodes[request.statusCode] ?? `HTTP Error (${request.statusCode})`,
            message: `HTTP ${request.statusCode}: ${request.pathname}`,
        };
    } else {
        error = {
            name: request.name,
            message: request.message,
            stack: request.stack,
        };
    }

    RecordErrorLog({
        error,
        requestUrl: {
            pathname: request.pathname,
        },
        severity,
        source: kErrorSource.Client,
        user: props.user,
    });

    return { };
}

// The /api/error route only provides a single API - call it straight away.
export const POST = (request: NextRequest) => executeAction(request, kErrorDefinition, error);
