// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { EventTicketProvider } from '@lib/database/Types';

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
     * Whether the event has been published.
     */
    published: boolean;

    /**
     * Timezone in which the event will be taking place.
     */
    timeZone: Temporal.TimeZoneLike;

    /**
     * External services that this event integrates with.
     */
    integrations?: {
        /**
         * Festival ID assigned to this event in AnPlan.
         */
        anPlanFestivalId?: number;

        /**
         * GUID assigned to ticket sales for this event in Weeztix.
         */
        weeztixGuid?: string;

        /**
         * ID assigned to ticket sales for this event in YourTicketProvider / CM.com.
         */
        yourTicketProviderId?: number;
    };

    /**
     * Ticket automation that's been configured for this event.
     */
    tickets?: {
        /**
         * Ticketing partner selected for this event.
         */
        provider?: EventTicketProvider;

        /**
         * Whether to automatically grant tickets when they're accepted in a team.
         */
        enableAutoGrant?: boolean;

        /**
         * Whether to automatically revoke volunteer tickets when their participation ends.
         */
        enableAutoRevoke?: boolean;

        /**
         * Unique ID of the ticket that volunteers should be assigned.
         */
        ticketId?: string;
    };
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
     * Domain on which the team's content and portal access will be served.
     */
    domain: string;

    /**
     * Name using which the team should be referred to in writing.
     * @example "Volunteering Crew"
     */
    name: string;

    /**
     * Title using which the team should be referred to in user interface.
     * @example "Crew"
     */
    title: string;

    /**
     * Private invite key used to generate targetted invite links for this team.
     */
    inviteKey: string;

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
