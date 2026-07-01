// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { LogPayloadAllowedTypes, LogDifferences } from './LogTypes';
import type { LogTypeParameters, LogType } from './LogDescriptors';
import type { LogSeverity } from '@lib/database/Types';
import type { User } from '../auth/User';
import { LogMessage } from './LogMessage';
import { RecordAfterRequestFinished, RecordImmediately } from './LogRecorder';

/**
 * The `LogBuilder` class is the main mechanism through which features can write log entries. The
 * basic usage is identical for most features: obtain an instance for a particular type, adjust
 * attribution and severity in accordance to the circumstances, and record the entry.
 *
 * ```
 * LogBuilder.for('UpdateAccountSubscriptions')
 *     .withInitiatorUser(user)
 *     .withAffectedUser(targetUser)
 *     .withDiff({
 *         Subscriptions: {
 *             before: [ 'Incident', 'Registration' ],
 *             after: [ 'HelpRequest', 'Incident', 'Registration' ],
 *         }
 *     })
 *     .record();
 * ```
 *
 * Messages can be recorded lazily when they are in the Next.js request flow by using `record()`, or
 * eagerly when they should be considered blocking or are out of the request flow by calling
 * `recordImmediate()` instead.
 */
export class LogBuilder<T extends LogType> {
    /**
     * Creates a new instance of the `LogBuilder` class for a message of the given `type`. The
     * returned instance will be strongly tied to the expected properties of that type.
     */
    static for<T extends LogType>(type: T): LogBuilder<T> {
        return new LogBuilder(type);
    }

    // ---------------------------------------------------------------------------------------------

    #type: T;

    #diff: LogDifferences | undefined;
    #severity: LogSeverity = 'Info';

    #initiatorUserId: number | undefined;
    #affectedUserId: number | undefined;

    private constructor(type: T) {
        this.#type = type;
    }

    // ---------------------------------------------------------------------------------------------

    /**
     * Record the `diff` as the differences that were written as part of this action. The `diff`
     * will be filtered, and before-after pairs that are unchanged won't be recorded with the log.
     */
    withDiff(diff: LogDifferences): this {
        this.#diff = this.filterDiff(diff);
        return this;
    }

    /**
     * Record the `initiatorUser` as the person who initiated this action.
     */
    withInitiatorUser(initiatorUser: User | number): this {
        this.#initiatorUserId =
            typeof initiatorUser === 'number' ? initiatorUser : initiatorUser.id;

        return this;
    }

    /**
     * Record the `targetUser` as the person who was affected by this action.
     */
    withAffectedUser(affectedUser: User | number): this {
        this.#affectedUserId =
            typeof affectedUser === 'number' ? affectedUser : affectedUser.id;

        return this;
    }

    /**
     * Record the `severity` as the severity of the action that was committed.
     */
    withSeverity(severity: LogSeverity): this {
        this.#severity = severity;
        return this;
    }

    // ---------------------------------------------------------------------------------------------

    /**
     * Records the log entry to the database. The information will be committed lazily outside of
     * the regular request flow to not block the user experience.
     */
    record(params?: LogTypeParameters<T>): void {
        RecordAfterRequestFinished(this.build(params));
    }

    /**
     * Records the log entry to the database. The information will be committed immediately, and the
     * caller is expected to `await` on the call completing.
     */
    recordImmediately(params?: LogTypeParameters<T>): Promise<void> {
        return RecordImmediately(this.build(params));
    }

    // ---------------------------------------------------------------------------------------------

    /**
     * Builds the log entry to a `LogMessage` instance. The `params` cannot be validated because
     * there is no non-TypeScript representation of them, so we rely on the compiler.
     */
    build(params?: LogTypeParameters<T>): LogMessage {
        return new LogMessage({
            type: this.#type,

            diff: this.#diff,
            severity: this.#severity,

            initiatorUserId: this.#initiatorUserId,
            affectedUserId: this.#affectedUserId,

            parameters: params,
        });
    }

    // ---------------------------------------------------------------------------------------------

    /**
     * Mechanism to filter the `diff` to just the entries where the before-after have actually
     * changed, ignoring the ones where no change has taken place.
     */
    private filterDiff(diff: LogDifferences): LogDifferences {
        function hasChanged(
            before: LogPayloadAllowedTypes,
            after: LogPayloadAllowedTypes): boolean
        {
            if (!Array.isArray(before) || !Array.isArray(after))
                return before !== after;

            if (before.length !== after.length)
                return true;  // the lengths have changed

            return before.some((value, index) => value !== after[index]);
        }

        const filteredDiff: LogDifferences = {};
        for (const [ label, pair ] of Object.entries(diff)) {
            if (!hasChanged(pair.before, pair.after))
                continue;

            filteredDiff[label] = pair;
        }

        return filteredDiff;
    }
}
