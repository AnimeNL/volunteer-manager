// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import type { CommunicationPromptId } from '@lib/ai/PromptFactory';
import { LogBuilder } from '@lib/log/index';
import { executeServerAction } from '@lib/serverAction';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';
import { sendCommunication } from '@app/admin/components/CommunicationDialog/sendCommunication';
import db, { tEvents, tHotelsBookings, tUsersEvents } from '@lib/database';

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
 * Server Action that will be invoked by the <CommunicationDialog> component when a hotel
 * confirmation message should be sent on the user's behalf.
 */
export async function sendHotelConfirmationCommunication(
    eventSlug: string, bookingId: number, recipientId: number, teamId: number,
    promptId: CommunicationPromptId, subject?: string, message?: string)
{
    return executeServerAction(new FormData(), z.object({ /* none */ }), async (data, props) => {
        const { event } = await requireAuthenticationWithEvent(
            props.authenticationContext, eventSlug, 'event.hotels');

        if (!event.flags.enableHotel || !recipientId || !teamId)
            notFound();

        const booking = await db.selectFrom(tHotelsBookings)
            .innerJoin(tUsersEvents)
                .on(tUsersEvents.eventId.equals(tHotelsBookings.eventId))
                    .and(tUsersEvents.userId.equals(recipientId))
                    .and(tUsersEvents.teamId.equals(teamId))
            .where(tHotelsBookings.bookingId.equals(bookingId))
                .and(tHotelsBookings.eventId.equals(event.id))
                .and(tHotelsBookings.bookingDeleted.isNull())
                .and(tHotelsBookings.bookingFirstUserId.equals(recipientId).or(
                    tHotelsBookings.bookingSecondUserId.equals(recipientId)).or(
                    tHotelsBookings.bookingThirdUserId.equals(recipientId)))
            .select({
                teamId: tUsersEvents.teamId,
            })
            .executeSelectNoneOrOne();

        if (!booking)
            notFound();

        if (!subject || !message)
            return { success: false, error: 'Subject and/or message are missing from the request' };

        await sendCommunication({
            sender: props.user,
            recipient: recipientId,
            subject,
            message,
            metadata: {
                eventId: event.id,
                teamId: booking.teamId,
                promptId,
            },
        });

        return {
            success: true,
            refresh: true,
            message: 'The e-mail has been sent, thank you for keeping them in the loop!',
        };
    });
}

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
                published: !!data.hotelInformationPublished ? 'Published' : 'Unpublished',
                type: 'hotel',
            });

        return { success: true };
    });
}
