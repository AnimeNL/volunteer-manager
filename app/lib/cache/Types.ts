// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Information globally cached for a particular event.
 */
export interface CachedEvent {
    /**
     * Unique ID of the event.
     */
    id: number;

    /**
     * Unique URL-safe representation of the event's identity.
     */
    slug: string;

    /**
     * Full name (e.g. "AnimeCon 2027: Into the Wild") identifying this event.
     */
    name: string;

    /**
     * Short name (e.g. "AnimeCon 2027") identifying this event.
     */
    shortName: string;
}

/**
 * Information globally cached for a particular team.
 */
export interface CachedTeam {
    /**
     * Unique ID of the team.
     */
    id: number;

    /**
     * Unique URL-safe representation of the team's identity.
     */
    slug: string;

    /**
     * Name using which the team should be represented in the user interface.
     */
    name: string;
}
