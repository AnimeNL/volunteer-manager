// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { after } from 'next/server';
import { headers } from 'next/headers';

import type { User } from '@lib/auth/User';
import db, { tErrorLogs, tLogs, truncateToByteLength } from '@lib/database';

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
 * Enumeration containing all the valid log types. Will be stored as a string, so keep alphabetized.
 */
export const kLogType = {
    AccountActivate: 'account-activate',
    AccountIdentifyAccessCode: 'account-identify-access-code',
    AccountIdentifyPasskey: 'account-identify-passkey',
    AccountIdentifyPassword: 'account-identify-password',
    AccountIdentityCheck: 'account-identity-check',
    AccountPasskeyCreate: 'account-passkey-create',
    AccountPasskeyDelete: 'account-passkey-delete',
    AccountPasswordResetRequest: 'account-password-reset-request',
    AccountPasswordReset: 'account-password-reset',
    AccountPasswordUpdate: 'account-password-update',
    AccountUpdateAvatar: 'account-update-avatar',
    AccountUpdate: 'account-update',
} as const;

/**
 * Enumeration containing all the valid log types. Will be stored as a string, so keep alphabetized.
 */
type LogType = typeof kLogType[keyof typeof kLogType];

/**
 * Information about what happened that should be logged for future inspection. Not all fields are
 * necessary, but a basic log entry has a severity and a type.
 */
interface LogEntry {
    /**
     * Data pertaining to the cause of the entry, if applicable. Will be stored as JSON.
     */
    data?: any;

    /**
     * Severity of the log entry that's being logged. Defaults to "Info".
     */
    severity?: LogSeverity,

    /**
     * Information about the user who caused this log entry to be created.
     */
    sourceUser?: User | number;

    /**
     * The user about whom the log entry is being created.
     */
    targetUser?: User | number;

    /**
     * The type of log entry that's being written.
     */
    type: LogType;
}

/**
 * Logs the given `entry` to the database. This function will be executed after the current request
 * has completed, to avoid blocking the response as users don't get value out of log entries.
 */
export function RecordLog(entry: LogEntry): void {
    const { sourceUser, targetUser } = entry;

    let sourceUserId: number | null = null;
    if (sourceUser)
        sourceUserId = typeof sourceUser === 'number' ? sourceUser : sourceUser.id;

    let targetUserId: number | null = null;
    if (targetUser)
        targetUserId = typeof targetUser === 'number' ? targetUser : targetUser.id;

    const data = entry.data ? truncateToByteLength(JSON.stringify(entry.data)) : null;
    const severity = entry.severity ?? kLogSeverity.Info;

    after(async () => {
        const requestHeaders = await headers();

        const logSourceIpAddress = requestHeaders.get('x-forwarded-for');
        const logSourceUserAgent = requestHeaders.get('user-agent');

        await db.insertInto(tLogs)
            .values({
                logType: entry.type,
                logSeverity: severity,
                logSourceUserId: sourceUserId,
                logSourceIpAddress,
                logSourceUserAgent:
                    logSourceUserAgent ? truncateToByteLength(logSourceUserAgent) : null,
                logTargetUserId: targetUserId,
                logData: data,
            }).executeInsert();
    });
}

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
