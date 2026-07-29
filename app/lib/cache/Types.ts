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

    /**
     * Unique ID of the festival as assigned in AnPlan.
     */
    festivalId?: number;

    /**
     * Timezone in which the event will be taking place.
     */
    timeZone: Temporal.TimeZoneLike;
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

    /**
     * Flags that have been set for this team.
     */
    flags: {
        /**
         * Whether the Duty Book feature should be enabled for this team.
         */
        enableDutyBook: boolean;

        /**
         * Whether event scheduling tools should be enabled for this team.
         */
        enableScheduling: boolean;

        /**
         * Whether this team manages website content on the domain they're hosted on.
         */
        managesContent: boolean;

        /**
         * Whether this team manages the First Aid team during events.
         */
        managesFirstAid: boolean;

        /**
         * Whether this team manages the Knowledge Base for a particular event.
         */
        managesKnowledgeBase: boolean;

        /**
         * Whether this team manages the Security team during events.
         */
        managesSecurity: boolean;
    },
}
