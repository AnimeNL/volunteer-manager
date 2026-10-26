// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { LogBuilder } from '@lib/log/index';
import { executeServerAction } from '@lib/serverAction';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';
import db, { tEvents } from '@lib/database';

import { kTemporalZonedDateTime } from '@app/admin/lib/ZodTransformers';

/**
 * The data associated with a hotel configuration update.
 */
const kHotelConfigurationData = z.object({
    /**
     * Whether hotel information should be published on the registration portal.
     */
    hotelInformationPublished: z.coerce.number(),

    /**
     * Moment in time, if any, at which we'll start to accept hotel room preferences.
     */
    hotelPreferencesStart: kTemporalZonedDateTime.nullish(),

    /**
     * Moment in time, if any, at which we'll no longer accept hotel room preferences.
     */
    hotelPreferencesEnd: kTemporalZonedDateTime.nullish(),
});

/**
 * Server Action that will be invoked when the hotel configuration is being updated by a senior
 * volunteer. Synchronises the state update request with the database.
 */
export async function updateHotelConfiguration(eventSlug: string, formData: unknown) {
    return executeServerAction(formData, kHotelConfigurationData, async (data, props) => {
        const { event } = await requireAuthenticationWithEvent(
            props.authenticationContext, eventSlug, 'event.hotels');

        if (!event.flags.enableHotel)
            notFound();

        const affectedRows = await db.update(tEvents)
            .set({
                hotelInformationPublished: data.hotelInformationPublished,
                hotelPreferencesStart: data.hotelPreferencesStart,
                hotelPreferencesEnd: data.hotelPreferencesEnd,
            })
            .where(tEvents.eventId.equals(event.id))
            .executeUpdate();

        LogBuilder.for('UpdateEventPublishedInformation')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                event: event.shortName,
                published: !!data.hotelInformationPublished,
                type: 'hotel',
            });

        return { success: true };
    });
}
