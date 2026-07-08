// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { LogPayloadAllowedTypes } from './LogTypes';

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

    PublishSubscriptionTest: NoParameters;

    UpdateAccountSubscriptions: {
        added: string[];
        updated: string[];
        removed: string[];
    };

    // ---------------------------------------------------------------------------------------------
    // Administration > Dashboard > System
    // ---------------------------------------------------------------------------------------------

    CreateSchedulerTask: {
        taskName: string;
    };

    RepeatSchedulerTask: {
        taskId: number;
        taskName: string;
        repeatedTaskId: number;
    };

    UpdateIntegrationSettings: {
        integration: 'AnimeCon' | 'Email' | 'Google' | 'Twilio' | 'YourTicketProvider';
    }

    // ---------------------------------------------------------------------------------------------
    // Administration > Organisation > People & teams
    // ---------------------------------------------------------------------------------------------

    RespondToFeedback: {
        action: string;  // Acknowledged | Archived | Declined | Resolved
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

    PublishSubscriptionTest: 'PublishSubscriptionTest',
    UpdateAccountSubscriptions: 'UpdateAccountSubscriptions',

    // ---------------------------------------------------------------------------------------------
    // Administration > Dashboard > System
    // ---------------------------------------------------------------------------------------------

    CreateSchedulerTask: 'CreateSchedulerTask',
    RepeatSchedulerTask: 'RepeatSchedulerTask',
    UpdateIntegrationSettings: 'UpdateIntegrationSettings',

    // ---------------------------------------------------------------------------------------------
    // Administration > Organisation > People & teams
    // ---------------------------------------------------------------------------------------------

    RespondToFeedback: 'RespondToFeedback',

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

// -------------------------------------------------------------------------------------------------

/**
 * Utility type that substitutes and invalid log type parameter types with `never`.
 */
type ValidateLogTypeParameterMap<T> = {
    [K in keyof T]: T[K] extends Record<string, any>
        ? { [P in keyof T[K]]: T[K][P] extends LogPayloadAllowedTypes ? T[K][P] : never }
        : T[K];
};

/**
 * Utility type that asserts whether the `LogTypeParameterMap` does not contain any `never` types.
 */
type AssertValidLogTypeParameterMap =
    LogTypeParameterMap extends ValidateLogTypeParameterMap<LogTypeParameterMap> ? true : never;

/**
 * Actual assertion that the `LogTypeParameterMap` only contains valid payload types.
 *
 * If a compile error is generated by this line, then the `LogTypeParameterMap` contains one or more
 * log types that contain a payload not conformant to the `LogPayloadAllowedTypes` type -- most
 * likely something that was just added.
 *
 * Log message payloads only allow plain key-value data types as the metadata is intended for
 * display in a user interface. Additional types can be added, but then the UI needs to be updated.
 */
const __assertValidLogTypeParameterMap: AssertValidLogTypeParameterMap = true;
