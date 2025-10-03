// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { EnvironmentDomain } from './Environment';
import type { Temporal } from '@lib/Temporal';
import { isAvailabilityWindowOpen } from './isAvailabilityWindowOpen';

/**
 * Interface that maps to the database representation of an event.
 */
export interface EventDatabaseRow {
    eventId: number;
    eventName: string;
    eventShortName: string;
    eventSlug: string;
    eventFestivalId?: number;
    eventLocation?: string;
    eventTimezone: string;
    eventStartTime: Temporal.ZonedDateTime;
    eventEndTime: Temporal.ZonedDateTime;
    hotelEnabled: number;
    refundEnabled: number;
    trainingEnabled: number;
    environments: {
        environment?: string;
        enableApplications?: { start?: Temporal.ZonedDateTime; end?: Temporal.ZonedDateTime; };
        enableRegistration?: { start?: Temporal.ZonedDateTime; end?: Temporal.ZonedDateTime; };
        enableSchedule?: { start?: Temporal.ZonedDateTime; end?: Temporal.ZonedDateTime; };
        maximumVolunteers?: number;
    }[];
}

/**
 * Represents the data associated with one of the AnimeCon festivals made available to both server-
 * and client-side components.
 */
export interface EventData {
    /**
     * Unique ID of the event, as it exists in the database.
     */
    id: number;

    /**
     * Full name of this event, including the theme.
     */
    name: string;

    /**
     * Short name of this event.
     */
    shortName: string;

    /**
     * URL-safe slug that can be used to represent this event.
     */
    slug: string;

    /**
     * Internal AnPlan ID associated with this festival, if any.
     */
    festivalId?: number;

    /**
     * Timezone in which the event will be taking place.
     */
    timezone: string;

    /**
     * Start time of the event, as a `Temporal.ZonedDateTime`-compatible representation in UTC.
     */
    startTime: string;

    /**
     * End time of the event, as a `Temporal.ZonedDateTime`-compatible representation in UTC.
     */
    endTime: string;

    /**
     * Whether hotel room management is enabled for this event.
     */
    hotelEnabled: boolean;

    /**
     * Whether refund management is enabled for this event.
     */
    refundEnabled: boolean;

    /**
     * Whether training management is enabled for this event.
     */
    trainingEnabled: boolean;
}

/**
 * Represents the data associated with an event for a particular environment. Events can have
 * multiple environments associated with them.
 */
export interface EventEnvironmentData {
    /**
     * Whether applications are currently being accepted for this team. Does not take user-specific
     * overrides into account.
     */
    enableApplications: boolean;

    /**
     * Whether access to the event's registration portal is available.
     */
    enableRegistration: boolean;

    /**
     * Whether visitors have access to the event's volunteer portal.
     */
    enableSchedule: boolean;

    /**
     * Name of the environment that is currently being considered.
     */
    environmentName: string;

    /**
     * Maximum number of volunteers that are able to participate in this team.
     */
    maximumVolunteers?: number;
}

/**
 * Data associated with an event specific to a particular environment.
 */
export type EventDataWithEnvironment = EventData & EventEnvironmentData;

/**
 * Represents one of the AnimeCon festivals.
 */
export class Event implements EventData {
    #environments: Map<string, EventEnvironmentData>;
    #event: EventDatabaseRow;

    constructor(event: EventDatabaseRow) {
        this.#environments = new Map;
        this.#event = event;

        for (const environmentInfo of event.environments) {
            if (!environmentInfo.environment)
                continue;  // partial information, this should never happen

            this.#environments.set(environmentInfo.environment, {
                enableApplications: isAvailabilityWindowOpen(environmentInfo.enableApplications),
                enableRegistration: isAvailabilityWindowOpen(environmentInfo.enableRegistration),
                enableSchedule: isAvailabilityWindowOpen(environmentInfo.enableSchedule),
                environmentName: environmentInfo.environment,
                maximumVolunteers: environmentInfo.maximumVolunteers || undefined,
            });
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Functionality limited to server components:
    // ---------------------------------------------------------------------------------------------

    /**
     * Numeric unique ID of the event, as it's represented in the database.
     */
    get eventId() { return this.#event.eventId; }

    /**
     * Returns the location at which the event will be taking place. May be NULL.
     */
    get location() { return this.#event.eventLocation; }

    /**
     * Returns the `Temporal.ZonedDateTime` variant of the event's start time.
     */
    get temporalStartTime() { return this.#event.eventStartTime; }

    /**
     * Returns the `Temporal.ZonedDateTime` variant of the event's end time.
     */
    get temporalEndTime() { return this.#event.eventEndTime;}

    /**
     * Returns the environment information for the given |environment| domain when it exists, or
     * `undefined` in all other cases.
     */
    getEnvironmentData(environment: EnvironmentDomain): EventEnvironmentData | undefined {
        return this.#environments.get(environment);
    }

    // ---------------------------------------------------------------------------------------------
    // Functionality also available to client components, i.e. EventData implementation:
    // ---------------------------------------------------------------------------------------------

    get id() { return this.#event.eventId; }
    get name() { return this.#event.eventName; }
    get shortName() { return this.#event.eventShortName; }
    get slug() { return this.#event.eventSlug; }
    get festivalId() { return this.#event.eventFestivalId; }
    get timezone() { return this.#event.eventTimezone; }
    get startTime() { return this.#event.eventStartTime.toString(); }
    get endTime() { return this.#event.eventEndTime.toString(); }
    get hotelEnabled() { return !!this.#event.hotelEnabled; }
    get refundEnabled() { return !!this.#event.refundEnabled; }
    get trainingEnabled() { return !!this.#event.trainingEnabled; }

    // ---------------------------------------------------------------------------------------------
    // Functionality to obtain a plain EventData object:
    // ---------------------------------------------------------------------------------------------

    /**
     * Returns a plain JavaScript object that conforms to the EventData interface.
     */
    toEventData(): EventData;
    toEventData(environment: EnvironmentDomain): EventDataWithEnvironment;
    toEventData(environment?: EnvironmentDomain) {
        const eventData: EventData = {
            id: this.id,
            name: this.name,
            shortName: this.shortName,
            slug: this.slug,
            festivalId: this.festivalId,
            timezone: this.timezone,
            startTime: this.startTime,
            endTime: this.endTime,
            hotelEnabled: this.hotelEnabled,
            refundEnabled: this.refundEnabled,
            trainingEnabled: this.trainingEnabled,
        };

        if (!environment)
            return eventData;

        const environmentData = this.getEnvironmentData(environment);
        if (!environmentData)
            throw new Error(`This event does not have this environment: ${environment}`);

        return {
            ...eventData,

            enableApplications: environmentData.enableApplications,
            enableRegistration: environmentData.enableRegistration,
            enableSchedule: environmentData.enableSchedule,
            environmentName: environmentData.environmentName,
            maximumVolunteers: environmentData.maximumVolunteers,
        };
    }
}
