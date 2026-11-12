// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { forbidden } from 'next/navigation';
import { z } from 'zod/v4';

import type { LogSeverity } from '@lib/database/Types';
import { RecordErrorLog } from '@lib/Log';
import { executeServerAction } from '@lib/serverAction';

import { kErrorSource } from '@lib/database/Types';
import { kLogSeverity } from '@lib/Log';

/**
 * HTTP Status codes for which this Server Action may be invoked.
 */
const kStatusCodes: { [k: number]: string } = {
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
};

/**
 * Zod type that describes the data required when reporting a client-side error.
 */
const kReportErrorData = z.object({
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
})));

/**
 * Server Action called by clients who have seen an unrecoverable runtime or HTTP status error. The
 * instance will be recorded in the error logs table.
 */
export async function reportError(formData: unknown) {
    return executeServerAction(formData, kReportErrorData, async (data, props) => {
        if (!props.ip)
            forbidden();

        let severity: LogSeverity = kLogSeverity.Info;
        let error: {
            name: string;
            message: string;
            stack?: string;
        };

        if ('statusCode' in data) {
            if (!!props.user)
                severity = kLogSeverity.Error;

            error = {
                name: kStatusCodes[data.statusCode] ?? `HTTP Error (${data.statusCode})`,
                message: `HTTP ${data.statusCode}: ${data.pathname}`,
            };
        } else {
            error = {
                name: data.name,
                message: data.message,
                stack: data.stack,
            };
        }

        RecordErrorLog({
            error,
            requestUrl: {
                pathname: data.pathname,
            },
            severity,
            source: kErrorSource.Client,
            user: props.user,
        });

        return { success: true };

    }, /* allowVisitors= */ true);
}
