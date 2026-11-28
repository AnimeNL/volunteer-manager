// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { EventTicketProvider, VendorTeam } from '@lib/database/Types';

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
     * URL to the theme image associated with this event.
     */
    imageUrl?: string;

    /**
     * Whether the event has been published.
     */
    published: boolean;

    /**
     * Place where the event will be taking place.
     */
    location?: string;

    /**
     * Date and time at which the event will commence.
     */
    startTime: Temporal.ZonedDateTime;

    /**
     * Date and time at which the event will conclude.
     */
    endTime: Temporal.ZonedDateTime;

    /**
     * Timezone in which the event will be taking place.
     */
    timeZone: string;

    /**
     * Flags that have been set for this event.
     */
    flags: {
        /**
         * Whether to enable functionality related to soliciting the build up crew.
         */
        enableBuildUp: boolean;

        /**
         * Whether to enable functionality related to hotel management.
         */
        enableHotel: boolean;

        /**
         * Whether to enable functionality related to managing refund requests.
         */
        enableRefunds: boolean;

        /**
         * Whether to enable functionality related to soliciting the tear down crew.
         */
        enableTearDown: boolean;

        /**
         * Whether to enable functionality related to training management.
         */
        enableTraining: boolean;
    };

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
        weeztixEventId?: string;

        /**
         * ID assigned to ticket sales for this event in YourTicketProvider / CM.com.
         */
        yourTicketProviderEventId?: number;

        /**
         * External ID assigned to ticket sales for this event in YourTicketProvider / CM.com.
         */
        yourTicketProviderExternalEventId?: string;
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
        volunteerTicketId?: string;

        /**
         * GUID of the Weeztix ticket type assigned to volunteers.
         */
        weeztixVolunteerTicketGuid?: string;
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
     * Unique ID of the environment on which the team's domain operates.
     */
    environmentId: number;

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
     * Plural form of the team's identity.
     */
    plural: string;

    /**
     * Colour that represents the team's identity.
     */
    color: string;

    /**
     * Private invite key used to generate targetted invite links for this team.
     */
    inviteKey: string;

    /**
     * External services that this team integrates with.
     */
    integrations: {
        /**
         * Account ID of the e-mail address this team uses for outbound communication.
         */
        emailAccountId: number;
    };

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

/**
 * Shift scheduled for a vendor team member, cached for the volunteer portal.
 */
export interface CachedVendorShift {
    /**
     * Unique ID of the vendor assigned to this shift.
     */
    vendorId: number;

    /**
     * Vendor team to which this shift belongs (e.g. First Aid or Security).
     */
    type: VendorTeam;

    /**
     * First name of the vendor assigned to this shift.
     */
    firstName: string;

    /**
     * Last name of the vendor assigned to this shift.
     */
    lastName: string;

    /**
     * Date and time at which the shift begins.
     */
    start: Temporal.ZonedDateTime;

    /**
     * Date and time at which the shift concludes.
     */
    end: Temporal.ZonedDateTime;
}

/**
 * Independently reloadable data slice within a cached `EventState` entry.
 */
export type EventStateSlice = 'program' | 'schedule' | 'shifts' | 'teams' | 'volunteers';

/**
 * Structural protocol implemented by entries stored in the `EventState` cache so `@lib/cache` can
 * perform surgical slice-level and volunteer-level invalidations without importing `@lib/event`.
 */
export interface InvalidatableEventStateEntry {
    /**
     * AnPlan festival ID associated with the cached event, if any.
     */
    readonly festivalId?: number;

    /**
     * Marks the given `slice` dirty so it is lazily reloaded on the next `getEventState()` call.
     */
    markDirty(slice: EventStateSlice): void;

    /**
     * Marks a single volunteer record dirty for surgical reload on the next `getEventState()` call.
     */
    markVolunteerDirty(userId: number): void;

    /**
     * Clears cached availability boundary hours so `VolunteerIndex` is rebuilt on the next read.
     */
    resetBoundaryHours(): void;
}
