// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { after } from 'next/server';
import { headers } from 'next/headers';

import type { LogMessage } from './LogMessage';
import db, { tLogs } from '@lib/database';

import { kLogDifferencesSchema, kLogPayloadRecord } from './LogTypes';

/**
 * Records the given `message` after the current Next.js request has finished.
 */
export function RecordAfterRequestFinished(message: LogMessage): void {
    let serialisedDiff: string | undefined;
    if (!!message.diff) {
        const normalisedDiff = kLogDifferencesSchema.parse(message.diff);
        serialisedDiff = JSON.stringify(normalisedDiff);
    }

    let serialisedParameters: string | undefined;
    if (!!message.parameters) {
        const normalisedParameters = kLogPayloadRecord.parse(message.parameters);
        serialisedParameters = JSON.stringify(normalisedParameters);
    }

    after(async () => {
        const requestHeaders = await headers();

        const logSourceIpAddress = requestHeaders.get('x-forwarded-for');
        const logSourceUserAgent = requestHeaders.get('user-agent');

        await db.insertInto(tLogs)
            .values({
                logType: message.type,
                logSeverity: message.severity,
                logSourceUserId: message.initiatorUserId,
                logSourceIpAddress,
                logSourceUserAgent,
                logTargetUserId: message.affectedUserId,
                logData: serialisedParameters,
                logDiff: serialisedDiff,
            }).executeInsert();
    });
}

/**
 * Records the given `message` immediately, and block on the database write being complete.
 */
export async function RecordImmediately(message: LogMessage): Promise<void> {
    let serialisedDiff: string | undefined;
    if (!!message.diff) {
        const normalisedDiff = kLogDifferencesSchema.parse(message.diff);
        serialisedDiff = JSON.stringify(normalisedDiff);
    }

    let serialisedParameters: string | undefined;
    if (!!message.parameters) {
        const normalisedParameters = kLogPayloadRecord.parse(message.parameters);
        serialisedParameters = JSON.stringify(normalisedParameters);
    }

    let logSourceIpAddress: string | null = null;
    let logSourceUserAgent: string | null = null;

    try {
        const requestHeaders = await headers();

        logSourceIpAddress = requestHeaders.get('x-forwarded-for');
        logSourceUserAgent = requestHeaders.get('user-agent');

    } catch (_error) {
        // IP address and user agent information are not available for uses of this function that
        // aren't in a Next.js request path, so we ignore the |_error|.
    }

    await db.insertInto(tLogs)
        .values({
            logType: message.type,
            logSeverity: message.severity,
            logSourceUserId: message.initiatorUserId,
            logSourceIpAddress,
            logSourceUserAgent,
            logTargetUserId: message.affectedUserId,
            logData: serialisedParameters,
            logDiff: serialisedDiff,
        }).executeInsert();
}
