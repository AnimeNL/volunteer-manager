// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { DBConnection } from '@lib/database/Connection';
import { tEvents } from '@lib/database';

/**
 * Parameters relaying context about the event that's in scope.
 */
export type EventContextParameters<FieldName extends string = 'event'> = {
    [K in FieldName]: {
        endDate: string;
        hotelEnabled: boolean;
        location?: string;
        name: string;
        shortName: string;
        slug: string;
        startDate: string;
        trainingEnabled: boolean;
    };
};

/**
 * Example parameters that convey information about a particular event that's in context.
 */
export const kEventContextExampleParameters: EventContextParameters['event'] = {
    endDate: '2026-04-19',
    hotelEnabled: true,
    location: 'De Broodfabriek, Rijswijk',
    name: 'AnimeCon 2026: Hidden Spirits',
    shortName: 'AnimeCon 2026',
    slug: '2026',
    startDate: '2026-04-17',
    trainingEnabled: true,
};

/**
 * Queries the event context for the given `eventId`. Will throw an exception when the given
 * `eventId` does not exist.
 */
export async function queryEventContext(db: DBConnection, eventId: number)
    : Promise<EventContextParameters['event']>
{
    return db.selectFrom(tEvents)
        .where(tEvents.eventId.equals(eventId))
        .select({
            endDate: db.dateTimeAsDateString(tEvents.eventEndTime),
            hotelEnabled: tEvents.hotelEnabled.equals(/* true= */ 1),
            location: tEvents.eventLocation,
            name: tEvents.eventName,
            shortName: tEvents.eventShortName,
            slug: tEvents.eventSlug,
            startDate: db.dateTimeAsDateString(tEvents.eventStartTime),
            trainingEnabled: tEvents.trainingEnabled.equals(/* true= */ 1),
        })
        .executeSelectOne();
}
