// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { LogSeverity } from '@lib/database/Types';
import type { LogType } from './LogDescriptors';

/**
 * Types that are allowed to be used in the `withDiff` builder.
 * @ignore Exported exclusively for use in the `LogBuilder`.
 */
export type LogMessageDifferenceAllowedTypes =
    string | string[] | number | number[] | boolean | boolean;

/**
 * Strict pair of types, as we require the before and after to be of the same type.
 */
type LogMessageDifferenceStrictPair<T = LogMessageDifferenceAllowedTypes> =
    T extends any ? { before: T, after: T }
                  : never;

/**
 * Structure through which differences can be included in the log entry.
 */
export type LogMessageDifferences = {
    [label: string]: LogMessageDifferenceStrictPair;
};

/**
 * Class that represents a log message. Contains all information necessary for the message to either
 * be logged to the database, or to be presented to the user. Type agnostic.
 */
export class LogMessage<T extends LogType = any> {
    #type: T;

    #diff: LogMessageDifferences | undefined;
    #severity: LogSeverity;

    #initiatorUserId: number | undefined;
    #affectedUserId: number | undefined;

    #parameters: any;

    constructor(params: {
        type: T;

        diff: LogMessageDifferences | undefined;
        severity: LogSeverity;

        initiatorUserId: number | undefined;
        affectedUserId: number | undefined;

        parameters: any;
    }) {
        this.#type = params.type;

        this.#diff = params.diff;
        this.#severity = params.severity;

        this.#initiatorUserId = params.initiatorUserId;
        this.#affectedUserId = params.affectedUserId;

        this.#parameters = params.parameters;
    }

    /**
     * Type of log entry that this builde represents.
     */
    get type() { return this.#type; }

    /**
     * Differences that were written to the database for the committed action.
     */
    get diff() { return this.#diff; }

    /**
     * Severity of the action that has been committed.
     */
    get severity() { return this.#severity; }

    /**
     * Unique ID of the user who initiated this action.
     */
    get initiatorUserId() { return this.#initiatorUserId; }

    /**
     * Unique ID of the user who was affected by this action.
     */
    get affectedUserId() { return this.#affectedUserId; }

    /**
     * Parameters that were attached to this log message.
     */
    get parameters() { return this.#parameters; }
}
