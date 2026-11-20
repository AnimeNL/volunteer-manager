// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { AuthenticationResult } from './AuthenticationContext';
import type { AuthType } from '../database/Types';
import type { User } from './User';
import type { useMockConnection } from '@lib/database/Connection';
import { AccessControl } from './access/AccessControl';

import { kAuthType } from '../database/Types';

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
    events?: Map</* eventSlug= */ string, /* teamSlug= */ string>;
}

/**
 * Builds a new instance of an AuthenticationContext, for testing purposes. All fields are optional
 * and will be substituted with default values.
 */
export function buildAuthenticationContext(params?: BuildAuthenticationContextParams) {
    params = params ?? {};
    return {
        access: new AccessControl(params.access ?? { /* empty */ }),
        user: {
            id: 2000000,
            username: 'joe@example.com',
            name: 'Joe Example',
            nameOrFirstName: 'Joe',
            firstName: 'Joe',
            lastName: 'Example',
            avatarUrl: undefined,

            ...params.user,
        },
        authType: params.authType ?? kAuthType.password,
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
        // UserAuthenticationContext.events:
        events: [],

        // UserAuthenticationContext.user:
        userId: 2000000,
        username: 'joe@example.com',
        firstName: 'Joe',
        lastName: 'Example',
        avatarFileHash: undefined,

        ...authenticationResult
    }));
}
