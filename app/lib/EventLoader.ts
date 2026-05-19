// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import db, { tEvents } from './database';

/**
 * Returns a single event identified by the given |slug|, or undefined when it does not exist.
 */
export async function getEventBySlug(slug: string) {
    return await db.selectFrom(tEvents)
        .where(tEvents.eventSlug.equals(slug))
        .select({
            id: tEvents.eventId,
            eventId: tEvents.eventId,
            name: tEvents.eventName,
            shortName: tEvents.eventShortName,
            slug: tEvents.eventSlug,
            festivalId: tEvents.eventFestivalId,
            location: tEvents.eventLocation,
            timezone: tEvents.eventTimezone,
            temporalStartTime: tEvents.eventStartTime,
            temporalEndTime: tEvents.eventEndTime,
            startTime: db.dateTimeAsString(tEvents.eventStartTime),
            endTime: db.dateTimeAsString(tEvents.eventEndTime),

            hotelEnabled: tEvents.hotelEnabled,
            refundEnabled: tEvents.refundEnabled,
            trainingEnabled: tEvents.trainingEnabled,
        })
        .groupBy(tEvents.eventId)
        .orderBy(tEvents.eventStartTime, 'desc')
        .executeSelectNoneOrOne() ?? undefined;
}

/**
 * Derive the Event type from the getEventBySlug() helper.
 */
export type Event = NonNullable<Awaited<ReturnType<typeof getEventBySlug>>>;
