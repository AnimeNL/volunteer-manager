// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Interface describing the information we maintain on an individual user. Instances of these
 * objects can be obtained through the `loadUserAuthenticationContext()` function. Tests may mimic their own
 * users, but be sure to type it correctly to avoid unexpected breakages.
 */
export interface User {
    /**
     * Unique ID of the user, as they are represented in the database.
     */
    id: number;

    /**
     * The username of this user, generally their e-mail address. There exist users in the system
     * for whom no e-mail address (& thus username) is on record.
     */
    username?: string;

    /**
     * Name of the user - either their display name, or their full name.
     */
    name: string;

    /**
     * The first name of this user. Note that `nameOrFirstName` should be preferred when addressing
     * the user, in case they have a display name set.
     */
    firstName: string;

    /**
     * Either the volunteer's display name, or their first name.
     */
    nameOrFirstName: string;

    /**
     * The last name of this user.
     */
    lastName: string;

    /**
     * The name using which we should refer to the user.
     */
    displayName?: string;

    /**
     * URL using which this user's avatar can be retrieved.
     */
    avatarUrl?: string;
}
