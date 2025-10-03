// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import { Temporal } from '@lib/Temporal';
import { validateTime } from './validateTime';

import { kTemporalZonedDateTime } from '@app/api/Types';

/**
 * Type describing an availability exception, as stored in the database.
 * @todo Use this definition in all other places.
 */
export const kAvailabilityException = z.object({
    /**
     * Date and time on which the exception will start, in ISO 8601 format in UTC.
     */
    start: kTemporalZonedDateTime,

    /**
     * Date and time on which the exception will end, in ISO 8601 format in UTC.
     */
    end: kTemporalZonedDateTime,

    /**
     * State of this volunteer's availability during that period of time.
     */
    state: z.enum([ 'available', 'avoid', 'unavailable' ]),
});

/**
 * Information contained within a particular availability entry.
 */
type AvailabilityEntry = {
    start: Temporal.ZonedDateTime;
    end: Temporal.ZonedDateTime;
};

/**
 * Adjusts the given `entry` based on the `available` times, during which the volunteer will always
 * be marked as available. This may result in the `entry` being dropped entirely, either its start
 * or end time being adjusted, or for the `entry` to be split in multiple entries.
 */
function adjustForAvailableTimeslots(entry: AvailabilityEntry, available: AvailabilityEntry[]) {
    // TODO: Implement this method.
    return [ entry ];
}

/**
 * Information that represents a particular volunteer's availability.
 */
type AvailabilityInfo = {
    avoid: AvailabilityEntry[];
    unavailable: AvailabilityEntry[];
};

/**
 * Information necessary to determine the markers for a given volunteer.
 */
type AvailabilityInput = {
    event: {
        startTime: Temporal.ZonedDateTime,
        endTime: Temporal.ZonedDateTime,
        timezone: string,
    },
    settings: {
        'schedule-day-view-start-time'?: string,
        'schedule-event-view-start-hours'?: number,
        'schedule-event-view-end-hours'?: number,
    },
    timeslots: Map<number, AvailabilityEntry>,
    volunteer: {
        availabilityExceptions?: string;
        availabilityTimeslots?: string;
        preferenceTimingStart?: number;
        preferenceTimingEnd?: number;
    }
};

/**
 * Determines the availability for the given `volunteer`. This can be used to create markers to
 * indicate their availability, and to calculate warnings when those are ignored.
 */
export function determineAvailability(input: AvailabilityInput): AvailabilityInfo {
    const { event, settings, timeslots, volunteer } = input;

    const available: AvailabilityEntry[] = [];
    const availability: AvailabilityInfo = {
        avoid: [],
        unavailable: [],
    };

    // (1) Process availability exceptions. These take precedence over other blocks.
    if (!!volunteer.availabilityExceptions && volunteer.availabilityExceptions.length > 4) {
        try {
            const availabilityExceptionsString = JSON.parse(volunteer.availabilityExceptions);
            const availabilityExceptions =
                z.array(kAvailabilityException).parse(availabilityExceptionsString);

            for (const { start, end, state } of availabilityExceptions) {
                switch (state) {
                    case 'available':
                        available.push({ start, end });
                        break;

                    case 'avoid':
                    case 'unavailable':
                        availability[state].push({ start, end });
                        break;
                }
            }
        } catch (error: any) {
            console.warn(`Invalid availability exceptions seen: ${volunteer}`, error);
        }
    }

    // (2) Process timelines. These will be marked as "avoid" on the volunteer's schedule.
    if (!!volunteer.availabilityTimeslots && volunteer.availabilityTimeslots.length > 2) {
        try {
            const availabilityTimeslots =
                volunteer.availabilityTimeslots.split(',').map(v => parseInt(v, 10));

            for (const timeslotId of availabilityTimeslots) {
                const timeslot = timeslots.get(timeslotId);
                if (!timeslot)
                    continue;  // invalid timeslot

                const adjustedTimeslot = adjustForAvailableTimeslots(timeslot, available);
                if (!!adjustedTimeslot)
                    availability.avoid.push(...adjustedTimeslot);
            }
        } catch (error: any) {
            console.warn(`Invalid availability timeslots seen: ${volunteer}`, error);
        }
    }

    // (3) Process the volunteer's preferred start and end times for helping out.
    if (volunteer.preferenceTimingStart !== undefined &&
            volunteer.preferenceTimingEnd !== undefined) {
        // Determine the first and the last day:
        const firstDay =
            event.startTime.withTimeZone(event.timezone).with({ hour: 0, minute: 0, second: 0 });
        const lastDay =
            event.endTime.withTimeZone(event.timezone).with({ hour: 0, minute: 0, second: 0 });

        // Determine the hour on which the first festival day will start:
        const eventStartHour = event.startTime.withTimeZone(event.timezone).hour;
        const eventStartScheduleHour =
            eventStartHour - (settings['schedule-event-view-start-hours'] ?? 4);

        // Determine the hour on which a regular festival day will start:
        const dailyStartTime = validateTime(settings['schedule-day-view-start-time'], '08:00');
        const dailyStartHour = parseInt(dailyStartTime.split(':')[0], 10);

        let currentDay = firstDay;
        while (Temporal.ZonedDateTime.compare(currentDay, lastDay) <= 0) {
            let startHour: number;
            if (currentDay.epochMilliseconds === firstDay.epochMilliseconds)
                startHour = 0;  // midnight, event hasn't started yet
            else if (volunteer.preferenceTimingEnd > dailyStartHour)
                startHour = volunteer.preferenceTimingEnd - 24;
            else
                startHour = volunteer.preferenceTimingEnd;

            let endHour: number;
            if (currentDay.epochMilliseconds === firstDay.epochMilliseconds) {
                if (eventStartScheduleHour < volunteer.preferenceTimingStart)
                    endHour = volunteer.preferenceTimingStart;
                else
                    endHour = eventStartScheduleHour;
            } else {
                endHour = volunteer.preferenceTimingStart;
            }

            const timeslot: AvailabilityEntry = {
                start: currentDay.add({ hours: startHour }),
                end: currentDay.add({ hours: endHour }),
            };

            const adjustedTimeslot = adjustForAvailableTimeslots(timeslot, available);
            if (!!adjustedTimeslot)
                availability.unavailable.push(...adjustedTimeslot);

            currentDay = currentDay.add({ days: 1 });
        }

        // Add one more timeslot after the event has finished, until midnight, to complete the
        // timeline. This ensures that everything looks consistent.
        {
            const closingTimeslot: AvailabilityEntry = {
                end: lastDay.with({ hour: 23, minute: 59, second: 59 }),
                start: event.endTime.withTimeZone(event.timezone)
                    .add({ hours: settings['schedule-event-view-end-hours'] ?? 2 }),
            };

            const adjustedTimeslot = adjustForAvailableTimeslots(closingTimeslot, available);
            if (!!adjustedTimeslot)
                availability.unavailable.push(...adjustedTimeslot);
        }
    }

    return availability;
}
