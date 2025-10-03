// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Event } from '@lib/Event';
import type { Temporal } from '@lib/Temporal';
import { getTimeslots } from './getTimeslots';
import { readSettings } from '@lib/Settings';
import { determineAvailability } from './determineAvailability';
import db, { tSchedule } from '@lib/database';

/**
 * Type that defines the information we need to know about a particular shift.
 */
type ShiftInfo = { start: Temporal.ZonedDateTime; end: Temporal.ZonedDateTime; };

/**
 * Type that defines the information we need to know about a particular volunteer.
 */
type VolunteerInfo = {
    id: number;
    availabilityExceptions?: string;
    availabilityTimeslots?: string;
    preferenceTimingStart?: number;
    preferenceTimingEnd?: number;
};

/**
 * Determines whether the given `shift` is valid to schedule for the given `user`. This considers
 * both their existing shfits and their (un)availability, in relation to the current event.
 */
export async function isValidShift(
    event: Event, volunteer: VolunteerInfo, shift: ShiftInfo, ignoreShift?: number)
        : Promise<boolean>
{
    const timeslots = await getTimeslots(event.festivalId);
    const settings = await readSettings([
        'schedule-day-view-start-time',
        'schedule-event-view-start-hours',
        'schedule-event-view-end-hours',
    ]);

    // biome-ignore lint/correctness/noUnusedVariables: not implemented yet
    const availability = determineAvailability({
        event: {
            startTime: event.temporalStartTime,
            endTime: event.temporalEndTime,
            timezone: event.timezone,
        },
        settings,
        timeslots,
        volunteer: {
            availabilityExceptions: volunteer.availabilityExceptions,
            availabilityTimeslots: volunteer.availabilityTimeslots,
            // deliberately do not carry over the timing preferences, as that would block shifts
            // from being assigned there -- they are preferences, not rules
        },
    });

    // TODO: Process `availability.unavailable` - this isn't currently working

    const conflictingShiftIds = await db.selectFrom(tSchedule)
        .where(tSchedule.userId.equals(volunteer.id))
            .and(tSchedule.eventId.equals(event.id))
            .and(tSchedule.scheduleTimeStart.lessThan(shift.end))
            .and(tSchedule.scheduleTimeEnd.greaterThan(shift.start))
            .and(tSchedule.scheduleDeleted.isNull())
        .selectOneColumn(tSchedule.scheduleId)
        .executeSelectMany();

    if (!conflictingShiftIds.length)
        return true;  // no conflicting shifts were found

    if (conflictingShiftIds.length === 1 && conflictingShiftIds[0] === ignoreShift)
        return true;  // the only conflicting shift is the one we ignore

    return false;  // one or more actually conflicting shifts were found
}
