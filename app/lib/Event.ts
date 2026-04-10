// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Temporal } from '@lib/Temporal';

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
}

/**
 * Represents one of the AnimeCon festivals.
 */
export class Event implements EventData {
    #event: EventDatabaseRow;

    constructor(event: EventDatabaseRow) {
        this.#event = event;
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
}
