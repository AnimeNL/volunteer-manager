// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import { kVendorTeam as kVendorTeamEnum } from '@lib/database/Types';

/**
 * Represents the information shared for a particular vendor team. The actual information regarding
 * on-site personnel will usually be shared freely, whereas the full schedule is more restricted.
 */
const kVendorTeam = z.object({
    /**
     * Names of the active personnel who are on shift.
     */
    active: z.array(z.string()),

    /**
     * Full schedule assigned to the vendor team. Only shared with leadership.
     */
    schedule: z.array(z.object({
        /**
         * Unique ID of the vendor.
         */
        id: z.number(),

        /**
         * Name of the vendor, as it should be shown in the calendar.
         */
        name: z.string(),

        /**
         * Shifts assigned to this vendor, if any.
         */
        shifts: z.array(z.object({
            /**
             * Date and time on which the shift will start, as a UNIX timestamp since the epoch.
             */
            start: z.number(),

            /**
             * Date and time on which the shift will start, as a UNIX timestamp since the epoch.
             */
            end: z.number(),
        })),

    })),
});

/**
 * Type definition of the public schedule information for a particular vendor team.
 */
export type PublicVendorSchedule = z.infer<typeof kVendorTeam>['schedule'];

/**
 * Interface definition for the information contained within a public schedule.
 */
export const kPublicSchedule = z.strictObject({
    /**
     * Short name of the event for which the schedule is being shown.
     */
    event: z.string(),

    /**
     * Unique slug of the event for which the schedule is being shown.
     */
    slug: z.string(),

    /**
     * Configuration that should be conveyed to the client. Affects behaviour of the schedule app.
     */
    config: z.strictObject({
        /**
         * Number of active and pending activities to list for an area or location.
         */
        activityListLimit: z.number(),

        /**
         * Whether avatar management (for any volunteer) should be enabled.
         */
        enableAvatarManagement: z.boolean().optional(),

        /**
         * Whether the ability for volunteer to favourite events should be enabled.
         */
        enableFavourites: z.boolean().optional(),

        /**
         * Whether Del a Rie Advies is able to generate personalised advice.
         */
        enableGeneratedAdvice: z.boolean().optional(),

        /**
         * Whether access to help requests should be enabled.
         */
        enableHelpRequests: z.boolean().optional(),

        /**
         * Whether the knowledge base should be enabled.
         */
        enableKnowledgeBase: z.boolean(),

        /**
         * Whether searching through the knowledge base should be enabled.
         */
        enableKnowledgeBaseSearch: z.boolean(),

        /**
         * Whether convention days should be "logical" days rather than calendar days, i.e. shifts
         * that finish before 4AM will be counted as part of the previous day.
         */
        enableLogicalDays: z.boolean(),

        /**
         * Whether the volunteer is able to edit notes of other volunteers.
         */
        enableNotesEditor: z.boolean(),

        /**
         * Amount of fuzziness to apply to the search results. While this allows minor compensation
         * for typos, a high value could lead to less relevant results being presented to the user.
         */
        searchResultFuzziness: z.number(),

        /**
         * Maximum number of inline search results to show at once.
         */
        searchResultLimit: z.number(),

        /**
         * Minimum search score required for a result to be considered for presentation to the user.
         */
        searchResultMinimumScore: z.number(),

        /**
         * Whether historic days should be sorted to the bottom of the list.
         */
        sortPastDaysLast: z.boolean(),

        /**
         * Whether historic events should be sorted to the bottom of the list.
         */
        sortPastEventsLast: z.boolean(),

        /**
         * Time offset, in seconds, to alter the local timestamp by. Used to emulate the schedule at
         * another point in time for testing purposes.
         */
        timeOffset: z.number().optional(),

        /**
         * Timezone in which dates and times should be represented.
         */
        timezone: z.string(),

        /**
         * Update frequency, per which clients will check back in with the server.
         */
        updateFrequencyMs: z.number(),
    }),

    /**
     * Activity IDs that have been favourited by the volunteer.
     */
    favourites: z.record(z.string(), z.literal(true)).optional(),

    /**
     * Number of help requests that are still pending activity from a senior volunteer.
     */
    helpRequestsPending: z.number().optional(),

    /**
     * The event's kwowledge base, however, without the answers. These will be loaded on demand.
     */
    knowledge: z.array(z.strictObject({
        /**
         * Unique ID of the knowledge base category.
         */
        id: z.number(),

        /**
         * Name of the icon using which the category should be represented.
         */
        icon: z.string(),

        /**
         * Title of the category, to be used in the user interface.
         */
        title: z.string(),

        /**
         * Description of the category, to be used in the user interface.
         */
        description: z.string().optional(),

        /**
         * Whether the category is gated behind a permission.
         */
        limited: z.literal(true).optional(),

        /**
         * Record containing all questions (keys) that exist in this category, each valued by the
         * unique Id of the question in the database to enable deep links.
         */
        questions: z.record(z.string(), z.string()),
    })),

    /**
     * Information about the event's program.
     */
    program: z.strictObject({
        /**
         * Activities part of the program. Record keyed by the activity's ID as a string, followed
         * by an object describing its metadata.
         */
        activities: z.record(z.string(), z.strictObject({
            /**
             * Unique ID of the activity.
             */
            id: z.string(),

            /**
             * Title, as the activity should be presented to users.
             */
            title: z.string(),

            /**
             * Timeslots that exist for this activity.
             */
            timeslots: z.array(z.string()),

            /**
             * Whether timeslots for this activity should be hidden from the portal. Should only be
             * used for dynamically generated activities.
             */
            timeslotsHidden: z.literal(true).optional(),

            /**
             * Set when the timeslot is invisible to the public.
             */
            invisible: z.literal(true).optional(),

            /**
             * Product information associated with this activity, when available to the volunteer.
             */
            products: z.array(z.strictObject({
                /**
                 * Name of the product as it should be presented.
                 */
                product: z.string(),

                /**
                 * When known, the maximum number of times that this product can be sold.
                 */
                limit: z.number().optional(),

                /**
                 * When known, price of the product, in euros.
                 */
                price: z.number().optional(),

                /**
                 * The number of products that have been sold so far.
                 */
                sold: z.number(),

            })).optional(),

            /**
             * Scheduled shifts that will be taking place as part of this activity.
             */
            schedule: z.array(z.string()),

            /**
             * Set when all products associated with the activity have sold out.
             */
            soldOut: z.literal(true).optional(),
        })),

        /**
         * Areas that exist within the festival's location. Record keyed by the area's ID as a
         * string, followed by an object describing its metadata.
         */
        areas: z.record(z.string(), z.strictObject({
            /**
             * Unique ID of the area.
             */
            id: z.string(),

            /**
             * Name of the area, as it should be presented to users.
             */
            name: z.string(),

            /**
             * Locations that are located in this area.
             */
            locations: z.array(z.string()),

            /**
             * Number of active events (& shifts) that are taking place in this area.
             */
            active: z.number(),
        })),

        /**
         * Locations that exist within the festival's location. Record keyed by the location's ID as
         * a string, followed by an object describing its metadata.
         */
        locations: z.record(z.string(), z.strictObject({
            /**
             * Unique ID of the location.
             */
            id: z.string(),

            /**
             * Name of the location, as it should be presented to users.
             */
            name: z.string(),

            /**
             * Unique ID of the area within which this location is located.
             */
            area: z.string(),

            /**
             * Timeslots that will be taking place in this location.
             */
            timeslots: z.array(z.string()),

            /**
             * Number of active events (& shifts) that are taking place in this location.
             */
            active: z.number(),
        })),

        /**
         * Timeslots that will happen during the festival. Each timeslot is associated with an
         * activity that's part of the program.
         */
        timeslots: z.record(z.string(), z.strictObject({
            /**
             * Unique ID of the timeslot.
             */
            id: z.string(),

            /**
             * Unique ID of the activity this timeslot belongs to.
             */
            activity: z.string(),

            /**
             * Unique ID of the location this timeslot will be hosted in.
             */
            location: z.string(),

            /**
             * Date and time on which the slot will start, as a UNIX timestamp since the epoch.
             */
            start: z.number(),

            /**
             * Date and time on which the slot will end, as a UNIX timestamp since the epoch.
             */
            end: z.number(),

            /**
             * Whether the timeslot is currently active, and should be presented as such.
             */
            active: z.literal(true).optional(),
        })),
    }),

    /**
     * The excellent piece of Del a Rie advice that should be shown on the overview page.
     */
    nardo: z.string().optional(),

    /**
     * Scheduled shifts that volunteers will perform during the event.
     */
    schedule: z.record(z.string(), z.strictObject({
        /**
         * Unique ID of the scheduled shift.
         */
        id: z.string(),

        /**
         * Unique ID of the volunteer who will be performing this shift.
         */
        volunteer: z.string(),

        /**
         * Unique ID of the shift that they will be participating.
         */
        shift: z.string(),

        /**
         * Date and time on which the shift will start, as a UNIX timestamp since the epoch.
         */
        start: z.number(),

        /**
         * Date and time on which the shift will start, as a UNIX timestamp since the epoch.
         */
        end: z.number(),
    })),

    /**
     * Shifts that have been scheduled for volunteers during this event.
     */
    shifts: z.record(z.string(), z.strictObject({
        /**
         * Unique ID of the shift.
         */
        id: z.string(),

        /**
         * Unique ID of the activity this shift is part of.
         */
        activity: z.string(),

        /**
         * Unique ID of the team to whom the shift belongs.
         */
        team: z.string(),

        /**
         * Name associated with the shift.
         */
        name: z.string(),

        /**
         * Description of the shift, if any.
         */
        description: z.string().optional(),
    })),

    /**
     * Information about the teams for whom volunteers and/or shifts are included with the schedule.
     */
    teams: z.record(z.string(), z.strictObject({
        /**
         * Unique ID of the team.
         */
        id: z.string(),

        /**
         * Name of the team, as it should be presented to volunteers.
         */
        name: z.string(),

        /**
         * Colour associated with the team, used to emphasise their identity.
         */
        colour: z.string(),
    })),

    /**
     * Unique ID of the user to whom this schedule has been issued.
     */
    userId: z.number(),

    /**
     * Information about the vendors that will be helping out during the event. Regular volunteers
     * will be presented with an informational card, where volunteering leads will be able to see
     * their full availability in a calendar-style display.
     */
    vendors: z.partialRecord(z.enum(kVendorTeamEnum), kVendorTeam),

    /**
     * Number of volunteers who are currently on a shift.
     */
    volunteersActive: z.number(),

    /**
     * The volunteers who are scheduled to help out during this event, each keyed by their unique
     * User ID and with their associated information as a value.
     */
    volunteers: z.record(z.string(), z.strictObject({
        /**
         * Unique ID of the user.
         */
        id: z.string(),

        /**
         * URL of the user's avatar, if any. Users are able to upload a new image themselves.
         */
        avatar: z.string().optional(),

        /**
         * Name of the user, as it should be presented to other volunteers.
         */
        name: z.string(),

        /**
         * Role that the volunteer has been assigned to during the event.
         */
        role: z.string(),

        /**
         * Unique ID of the role that the volunteer has been assigned to during the event.
         */
        roleId: z.string(),

        /**
         * Whether the role that they're assigned to implies a senior position.
         */
        roleLeader: z.boolean().optional(),

        /**
         * Unique ID of the team that this volunteer is part of.
         */
        team: z.string(),

        /**
         * Notes associated with this user, if any. Only shared with leaders.
         */
        notes: z.string().optional(),

        /**
         * Phone number of the volunteer. Only available in certain cases.
         */
        phoneNumber: z.string().optional(),

        /**
         * Scheduled shifts that the volunteer will be participating in.
         */
        schedule: z.array(z.string()),

        /**
         * Unique ID of the shift that the volunteer is currently participating in, if any.
         */
        activeShift: z.string().optional(),

        /**
         * UNIX timestamp indicating when the volunteer will be avaialble again, if they're
         * currently not available and/or expected to be present on festival grounds. The value
         * "-1" represents that the volunteer is not expected to return from their absence.
         */
        unavailableUntil: z.number().optional(),
    })),
});

/**
 * Type definition of the public schedule information.
 */
export type PublicSchedule = z.infer<typeof kPublicSchedule>;
