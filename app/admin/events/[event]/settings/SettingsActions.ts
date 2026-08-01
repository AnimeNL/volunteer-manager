// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { z } from 'zod/v4';

import { Cache } from '@lib/cache';
import { LogBuilder } from '@lib/log/index';
import { executeServerAction } from '@lib/serverAction';
import { invalidateEventCache } from '@lib/cache';
import { requireAuthenticationWithEvent } from '../requireAuthenticationWithEvent';
import db, { tEvents } from '@lib/database';

import { kEventAvailabilityStatus } from '@lib/database/Types';
import { kTemporalZonedDateTime } from '@app/admin/lib/ZodTransformers';

/**
 * Data that needs to be available to update an event's cover image.
 */
const kChangeEventImageData = z.object({
    // TODO
});

/**
 * Server Action through which an event's cover image can be updated.
 */
export async function changeEventImage(eventSlug: string, formData: unknown) {
    return executeServerAction(formData, kChangeEventImageData, async (data, props) => {
        const { event } = await requireAuthenticationWithEvent(
            eventSlug, props.authenticationContext, 'event.settings');

        // TODO: Implement this action.

        return { success: false };
    });
}

/**
 * Data that needs to be available to update an event's URL-safe slug.
 */
const kChangeEventSlugData = z.object({
    slug: z.string().nonempty(),
});

/**
 * Server Action through which an event's URL-safe slug can be updated.
 */
export async function changeEventSlug(eventSlug: string, formData: unknown) {
    return executeServerAction(formData, kChangeEventSlugData, async (data, props) => {
        const { event } = await requireAuthenticationWithEvent(
            eventSlug, props.authenticationContext, 'event.settings');

        // TODO: Implement this action.

        return { success: false };
    });
}

/**
 * Server Action through which an event can be published or unpublished.
 */
export async function publishEvent(eventSlug: string) {
    return executeServerAction({ /* none */ }, z.object(), async (data, props) => {
        const { event } = await requireAuthenticationWithEvent(
            eventSlug, props.authenticationContext, 'event.settings');

        const affectedRows = await db.update(tEvents)
            .set({
                eventHidden: event.published ? 1 : 0,
            })
            .where(tEvents.eventId.equals(event.id))
                .and(tEvents.eventHidden.equals(event.published ? 0 : 1))
            .executeUpdate();

        await invalidateEventCache(event.id);

        // Active events in the navigation area now has to consider the updated status of |event|,
        // for which the cache has to be manually cleared.
        Cache.getInstance('AdminNavigationActiveEvents').clear();

        LogBuilder.for('UpdateEventPublicationStatus')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withSeverity('Error')
            .record({
                event: event.shortName,
                status: event.published ? 'Suspended' : 'Published',
            });

        return { success: true };
    });
}

/**
 * Data that needs to be available to update an event's features.
 */
const kEventFeaturesData = z.object({
    availabilityStatus: z.enum(kEventAvailabilityStatus),
    hotelEnabled: z.literal([ 0, 1 ]),
    refundEnabled: z.literal([ 0, 1 ]),
    trainingEnabled: z.literal([ 0, 1 ]),
    availabilityBuildUp: z.literal([ 0, 1 ]),
    availabilityTearDown: z.literal([ 0, 1 ]),
});

/**
 * Server Action through which an event's available features can be updated.
 */
export async function updateEventFeatures(eventSlug: string, formData: unknown) {
    return executeServerAction(formData, kEventFeaturesData, async (data, props) => {
        const { event } = await requireAuthenticationWithEvent(
            eventSlug, props.authenticationContext, 'event.settings');

        const affectedRows = await db.update(tEvents)
            .set({
                eventAvailabilityStatus: data.availabilityStatus,
                hotelEnabled: data.hotelEnabled,
                refundEnabled: data.refundEnabled,
                trainingEnabled: data.trainingEnabled,
                availabilityBuildUp: data.availabilityBuildUp,
                availabilityTearDown: data.availabilityTearDown,
            })
            .where(tEvents.eventId.equals(event.id))
            .executeUpdate();

        await invalidateEventCache(event.id);

        LogBuilder.for('UpdateEventSettings')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .record({
                event: event.shortName,
                type: 'basic',
            });

        return {
            success: true,
            refresh: true,  // menu item availability might change
        };
    });
}

/**
 * Data that needs to be available to update an event's identity.
 */
const kEventIdentityData = z.object({
    endTime: kTemporalZonedDateTime,
    eventTimingPublished: z.literal([ 0, 1 ]),
    location: z.string().nullish(),
    name: z.string().nonempty(),
    shortName: z.string().nonempty(),
    startTime: kTemporalZonedDateTime,
    timezone: z.string(),
});

/**
 * Server Action through which an event's identity can be updated.
 */
export async function updateEventIdentity(eventSlug: string, formData: unknown) {
    return executeServerAction(formData, kEventIdentityData, async (data, props) => {
        const { event } = await requireAuthenticationWithEvent(
            eventSlug, props.authenticationContext, 'event.settings');

        const affectedRows = await db.update(tEvents)
            .set({
                eventEndTime: data.endTime,
                eventLocation: data.location,
                eventName: data.name,
                eventShortName: data.shortName,
                eventStartTime: data.startTime,
                eventTimezone: data.timezone,
                eventTimingPublished: data.eventTimingPublished,
            })
            .where(tEvents.eventId.equals(event.id))
            .executeUpdate();

        await invalidateEventCache(event.id);

        LogBuilder.for('UpdateEventSettings')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .record({
                event: event.shortName,
                type: 'feature',
            });

        return {
            success: true,
            refresh: true,  // menu headers might change
        };
    });
}

/**
 * Data that needs to be available to update an event's associated services.
 */
const kEventIntegrationsData = z.object({
    festivalId: z.number().nullish(),
    hotelRoomForm: z.url().nullish(),
    yourTicketProviderId: z.number().nullish(),
    weeztixEventGuid: z.string().nullish(),
});

/**
 * Server Action through which an event's integrations can be updated.
 */
export async function updateEventIntegrations(eventSlug: string, formData: unknown) {
    return executeServerAction(formData, kEventIntegrationsData, async (data, props) => {
        const { event } = await requireAuthenticationWithEvent(
            eventSlug, props.authenticationContext, 'event.settings');

        const affectedRows = await db.update(tEvents)
            .set({
                eventFestivalId: data.festivalId,
                eventHotelRoomForm: data.hotelRoomForm,
                eventYtpId: data.yourTicketProviderId,
                eventWeeztixGuid: data.weeztixEventGuid,
            })
            .where(tEvents.eventId.equals(event.id))
            .executeUpdate();

        await invalidateEventCache(event.id);

        // Clear the `EventTicketTypes` cache in case the Weeztix or YourTicketProvider values
        // changed, in which case they will no longer be relevant.
        Cache.getInstance('EventTicketTypes').clear();

        LogBuilder.for('UpdateEventSettings')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .record({
                event: event.shortName,
                type: 'integration',
            });

        return {
            success: true,
            refresh: true,  // menu items might change
        };
    });
}
