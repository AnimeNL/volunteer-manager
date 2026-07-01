// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { LogDifferences } from './LogTypes';
import type { LogSeverity } from '@lib/database/Types';
import type { LogType } from './LogDescriptors';

/**
 * Class that represents a log message. Contains all information necessary for the message to either
 * be logged to the database, or to be presented to the user. Type agnostic.
 */
export class LogMessage<T extends LogType = any> {
    #type: T;

    #diff: LogDifferences | undefined;
    #severity: LogSeverity;

    #initiatorUserId: number | undefined;
    #affectedUserId: number | undefined;

    #parameters: any;

    constructor(params: {
        type: T;

        diff: LogDifferences | undefined;
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
