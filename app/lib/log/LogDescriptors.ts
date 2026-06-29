// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Utility type to indicate that no parameters are required for a particular log type.
 */
type NoParameters = Record<string, never>;

/**
 * Parameters that must be given for each of the log types.
 */
interface LogTypeParameterMap {
    // ---------------------------------------------------------------------------------------------
    // Administration > Dashboard > Communication
    // ---------------------------------------------------------------------------------------------

    UpdateAccountSubscriptions: {
        added: string[];
        updated: string[];
        removed: string[];
    };

    // ---------------------------------------------------------------------------------------------
    // Log types that should only be used for internal purposes:
    // ---------------------------------------------------------------------------------------------

    TestWithParameters: {
        firstName: string;
        age: number;
    };

    TestWithoutParameters: NoParameters;

    // ---------------------------------------------------------------------------------------------
    // Deprecated descriptors that should no longer be used:
    // ---------------------------------------------------------------------------------------------

    // TODO: None yet
}

/**
 * Set of unique names of log messages that can be recorded.
 */
export type LogType = keyof LogTypeParameterMap;

/**
 * Acquire the parameters that are required for a log message of type `T`.
 */
export type LogTypeParameters<T extends keyof LogTypeParameterMap> = LogTypeParameterMap[T];

/**
 * Names of the log types that exist in the system.
 */
export const kLogType: { [k in LogType]: k } = {
    // ---------------------------------------------------------------------------------------------
    // Administration > Dashboard > Communication
    // ---------------------------------------------------------------------------------------------

    UpdateAccountSubscriptions: 'UpdateAccountSubscriptions',

    // ---------------------------------------------------------------------------------------------
    // Log types that should only be used for internal purposes:
    // ---------------------------------------------------------------------------------------------

    TestWithParameters: 'TestWithParameters',
    TestWithoutParameters: 'TestWithoutParameters',

    // ---------------------------------------------------------------------------------------------
    // Deprecated descriptors that should no longer be used
    // ---------------------------------------------------------------------------------------------

    // TODO: None yet
};
