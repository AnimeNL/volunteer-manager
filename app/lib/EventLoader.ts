// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Event } from './Event';
import db, { tEvents } from './database';

/**
 * Returns a single event identified by the given |slug|, or undefined when it does not exist.
 */
export async function getEventBySlug(slug: string): Promise<Event | undefined> {
    const eventInfo = await db.selectFrom(tEvents)
        .where(tEvents.eventSlug.equals(slug))
        .select({
            eventId: tEvents.eventId,
            eventName: tEvents.eventName,
            eventShortName: tEvents.eventShortName,
            eventSlug: tEvents.eventSlug,
            eventFestivalId: tEvents.eventFestivalId,
            eventLocation: tEvents.eventLocation,
            eventTimezone: tEvents.eventTimezone,
            eventStartTime: tEvents.eventStartTime,
            eventEndTime: tEvents.eventEndTime,

            hotelEnabled: tEvents.hotelEnabled,
            refundEnabled: tEvents.refundEnabled,
            trainingEnabled: tEvents.trainingEnabled,
        })
        .groupBy(tEvents.eventId)
        .orderBy(tEvents.eventStartTime, 'desc')
        .executeSelectNoneOrOne();

    return eventInfo ? new Event(eventInfo)
                     : undefined;
}

/**
 * Returns the event name for the event uniquely identified by the given `eventId`, if any.
 */
export async function getEventNameForId(eventId: number): Promise<string | undefined> {
    return await db.selectFrom(tEvents)
        .where(tEvents.eventId.equals(eventId))
        .selectOneColumn(tEvents.eventShortName)
        .executeSelectNoneOrOne() ?? undefined;
}

/**
 * Returns the event slug for the event uniquely identified by the given `eventId`, if any.
 */
export async function getEventSlugForId(eventId: number): Promise<string | undefined> {
    return await db.selectFrom(tEvents)
        .where(tEvents.eventId.equals(eventId))
        .selectOneColumn(tEvents.eventSlug)
        .executeSelectNoneOrOne() ?? undefined;
}
