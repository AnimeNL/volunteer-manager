// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { AuthenticationContext, UserEventAuthenticationContext } from './AuthenticationContext';
import type { User } from './User';
import type { useMockConnection } from '@lib/database/Connection';
import { AccessControl } from './AccessControl';
import { AuthType } from '../database/Types';

/**
 * Type that describes the result of the query executed by `authenticateUser`. Defined because there
 * are a series of tests that mock user authentication.
 */
export interface AuthenticationResult {
    // AuthenticationContext.accessControl:
    accessControl?: {
        grants?: string;
        revokes?: string;
        events?: string;
        teams?: string;
    };

    // UserAuthenticationContext.authType:
    authType: AuthType,

    // UserAuthenticationContext.events:
    events: {
        event?: string;
        team?: string;

        isEventHidden?: number;
        isRoleAdmin?: number;
    }[],

    // UserAuthenticationContext.user:
    userId: number,
    username?: string,
    firstName: string,
    lastName: string,
    displayName?: string,
    avatarFileHash?: string,
    privileges: bigint,
}

/**
 * Parameters that can be provided when building an authentication context. All missing information
 * will be substituted with default values, and is not required to be given.
 */
interface BuildAuthenticationContextParams {
    access?: Partial<{
        grants?: string;
        revokes?: string;
        events?: string;
        teams?: string;
    }>;
    user?: Partial<User>;
    authType?: AuthType;
    events?: Map<string, UserEventAuthenticationContext>;
}

/**
 * Builds a new instance of an AuthenticationContext, for testing purposes. All fields are optional
 * and will be substituted with default values.
 */
export function buildAuthenticationContext(params?: BuildAuthenticationContextParams)
    : AuthenticationContext
{
    params = params ?? {};
    return {
        access: new AccessControl(params.access ?? { grants: 'everyone' }),
        user: {
            userId: 2000000,
            username: 'joe@example.com',
            name: 'Joe Example',
            firstName: 'Joe',
            lastName: 'Example',
            avatarUrl: undefined,
            privileges: 0n,

            ...params.user,
        },
        authType: params.authType ?? AuthType.password,
        events: params.events ?? new Map,
    };
}

type MockConnection = ReturnType<typeof useMockConnection>;

/**
 * Expects an authentication query on the given `mockConnection`, to which we'll respond with the
 * `authenticationResult` when given. Default values will be used for all data.
 */
export function expectAuthenticationQuery(
    mockConnection: MockConnection, authenticationResult?: Partial<AuthenticationResult>): void
{
    mockConnection.expect('selectOneRow', (query: string, params: any[]): AuthenticationResult => ({
        // UserAuthenticationContext.authType:
        authType: AuthType.password,

        // UserAuthenticationContext.events:
        events: [],

        // UserAuthenticationContext.user:
        userId: 2000000,
        username: 'joe@example.com',
        firstName: 'Joe',
        lastName: 'Example',
        avatarFileHash: undefined,
        privileges: 0n,

        ...authenticationResult
    }));
}
