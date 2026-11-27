// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { RequestedProgramTimeslot } from '@lib/event';
import { computeAvailabilityTimeline, parseAvailabilityExceptions } from '@lib/event';

/**
 * Returns a time that is guaranteed to be valid. The `input` will be used when it conforms to the
 * "HH:MM" syntax, otherwise `defaultValue` will be returned.
 */
export function validateTime(input: string | undefined, defaultValue: string): string {
    if (/^\d{1,2}:[0-5][0-9]$/.test(input || ''))
        return input!;

    return defaultValue;
}

/**
 * Information contained within a particular availability entry.
 */
type AvailabilityEntry = {
    start: Temporal.ZonedDateTime;
    end: Temporal.ZonedDateTime;
};

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
 * Determines the availability markers for the given `volunteer` using `@lib/event`'s layered
 * availability timeline compiler.
 */
export function determineAvailability(input: AvailabilityInput): AvailabilityInfo {
    const { event, settings, timeslots, volunteer } = input;

    const requestedTimeslots: RequestedProgramTimeslot[] = [];
    if (volunteer.availabilityTimeslots && volunteer.availabilityTimeslots.length > 0) {
        for (const rawId of volunteer.availabilityTimeslots.split(',')) {
            const timeslotId = Number.parseInt(rawId.trim(), 10);
            const timeslot = timeslots.get(timeslotId);
            if (!timeslot)
                continue;

            requestedTimeslots.push({
                id: timeslotId,
                startMs: timeslot.start.epochMilliseconds,
                endMs: timeslot.end.epochMilliseconds,
            });
        }
    }

    const timeline = computeAvailabilityTimeline(
        {
            event: {
                startTime: event.startTime,
                endTime: event.endTime,
                timeZone: event.timezone,
            },
            boundaryHours: {
                beforeStart: settings['schedule-event-view-start-hours'],
                afterEnd: settings['schedule-event-view-end-hours'],
            },
            availability: {
                preferenceTimingStart: volunteer.preferenceTimingStart,
                preferenceTimingEnd: volunteer.preferenceTimingEnd,
                exceptions: parseAvailabilityExceptions(volunteer.availabilityExceptions),
                requestedTimeslots,
            },
        },
        {
            includeRequestedEvents: true,
            includeShifts: false,
        });

    const availability: AvailabilityInfo = {
        avoid: [],
        unavailable: [],
    };

    for (const segment of timeline) {
        if (segment.kind !== 'avoid' && segment.kind !== 'unavailable')
            continue;

        availability[segment.kind].push({
            start: Temporal.Instant.fromEpochMilliseconds(segment.startMs)
                .toZonedDateTimeISO(event.timezone),
            end: Temporal.Instant.fromEpochMilliseconds(segment.endMs)
                .toZonedDateTimeISO(event.timezone),
        });
    }

    return availability;
}
