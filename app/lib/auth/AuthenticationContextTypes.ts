// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { AccessControl } from './AccessControl';
import type { User } from './User';
import type { AuthType } from '@lib/database/Types';

/**
 * Authentication Context specific to signed in users. Includes the user, as well as an overview of
 * the events that they've got access to.
 */
export interface UserAuthenticationContext {
    /**
     * Object that helps determine what permissions and permissions are granted to the visitor.
     */
    access: AccessControl;

    /**
     * The user who is currently signed in to their account.
     */
    user: User;

    /**
     * Authentication type that was used to sign the user in.
     */
    authType: AuthType;

    /**
     * Context regarding the user's access to events. Keyed by event slug ("2024"), and valued by
     * the slug of the team they're part of ("crew").
     */
    events: Map<string, string>;
}

/**
 * Authentication Context specific to visitors.
 */
export interface VisitorAuthenticationContext {
    /**
     * Object that helps determine what permissions and permissions are granted to the visitor.
     */
    access: AccessControl;

    /**
     * The user who is currently signed in to their account. Undefined for visitors.
     */
    user: undefined;
}

/**
 * Authentication Context, which defines not just the signed in user, but also detailed access
 * information about the level of access they have to different events.
 */
export type AuthenticationContext = UserAuthenticationContext | VisitorAuthenticationContext;
