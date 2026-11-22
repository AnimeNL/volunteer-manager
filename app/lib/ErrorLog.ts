// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { after } from 'next/server';
import { headers } from 'next/headers';

import type { User } from '@lib/auth';
import db, { tErrorLogs, truncateToByteLength } from '@lib/database';

import { kErrorSource, type ErrorSource } from './database/Types';

/**
 * Enumeration containing all the valid log severities. Will be stored as a string, and must be kept
 * in sync with the column definition in the database.
 *
 * @see Table `error_logs`
 * @see Table `logs`
 */
export type LogSeverity = typeof kLogSeverity[keyof typeof kLogSeverity];
export const kLogSeverity = {
    Debug: 'Debug',
    Info: 'Info',
    Warning: 'Warning',
    Error: 'Error',
} as const;

/**
 * Delegate that should be used to override the function used to defer writing error logs.
 */
let errorLogDeferDelegate: typeof after = after;

/**
 * Provides the ability to override the delegate through which writing logs will be deferred.
 */
export function SetRecordErrorLogDeferDelegate(delegate?: typeof after) {
    errorLogDeferDelegate = delegate ?? after;
}

/**
 * Information about what happened that should be logged for future inspection.
 */
interface ErrorLogEntry {
    /**
     * The error that should be logged in the database.
     */
    error: Error | {
        name: string;
        message: string;
        stack?: string;
    };

    /**
     * The request URL associated with this error log, when known.
     */
    requestUrl?: URL | { pathname: string };

    /**
     * Severity of the log entry that's being logged.
     */
    severity: LogSeverity;

    /**
     * Source from where the error originated, when known.
     */
    source?: ErrorSource;

    /**
     * The user whom triggered the error.
     */
    user?: User | number;
}

/**
 * Logs the given |error| in the database, making it possible to inspect issues with the system
 * out-of-band, even when no (easy) reproduction steps are available.
 */
export function RecordErrorLog(entry: ErrorLogEntry): void {
    let userId: number | null = null;
    if (entry.user)
        userId = typeof entry.user === 'number' ? entry.user : entry.user.id;

    errorLogDeferDelegate(async () => {
        const requestHeaders = await headers();

        const errorIpAddress = requestHeaders.get('x-forwarded-for') || '0.0.0.0';
        const errorOrigin = requestHeaders.get('host') || 'undefined';

        await db.insertInto(tErrorLogs)
            .values({
                errorDate: db.currentZonedDateTime(),
                errorSource: entry.source ?? kErrorSource.Server,
                errorSeverity: entry.severity ?? kLogSeverity.Info,
                errorUserId: userId,
                errorUserIdConfidence: userId ? 'Certain' : 'Undefined',
                errorIpAddress,
                errorOrigin,
                errorPathname: truncateToByteLength(entry.requestUrl?.pathname || ''),
                errorName: truncateToByteLength(entry.error.name),
                errorMessage: truncateToByteLength(entry.error.message),
                errorStack:
                    entry.error.stack ? truncateToByteLength(entry.error.stack) : undefined,
            }).executeInsert();
    });
}
