// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { z } from 'zod/v4';

import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';
import { Cache, getEvent, invalidateEventCache } from '@lib/cache';
import { storeBlobData } from '@lib/database/BlobStore';
import { LogBuilder } from '@lib/log/index';
import { executeServerAction } from '@lib/serverAction';
import db, { tEvents, tUsersEventsPreferencesRefunds, tYourTicketProviderPurchases } from '@lib/database';

import { kEventAvailabilityStatus, kEventTicketProvider, kFileType } from '@lib/database/Types';
import { kTemporalZonedDateTime } from '@app/admin/lib/ZodTransformers';

/**
 * Server Action through which refund requests can be anonymized. This permanently deletes data.
 */
export async function anonymizeRefundRequests(eventSlug: string) {
    return executeServerAction({ /* none */ }, z.object(), async (data, props) => {
        const { event } = await requireAuthenticationWithEvent(
            props.authenticationContext, eventSlug, 'admin');

        // This intentionally affects all versions, to avoid older variants of the data sticking
        // around in our database. The intention of this functionality is for the data to be gone.
        const affectedRows = await db.update(tUsersEventsPreferencesRefunds)
            .set({
                refundAccountName: '(anonymized)',
                refundAccountIban: '(anonymized)',
            })
            .where(tUsersEventsPreferencesRefunds.eventId.equals(event.id))
            .executeUpdate();

        LogBuilder.for('AnonymizeRefundRequests')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withSeverity('Error')
            .record({
                event: event.shortName
            });

        return {
            success: true,
            message: 'All bank account data has been anonymized.',
        };
    });
}

/**
 * Server Action through which visitor tickets can be anonymized. This permanently deletes data.
 */
export async function anonymizeVisitorTickets(eventSlug: string) {
    return executeServerAction({ /* none */ }, z.object(), async (data, props) => {
        const { event } = await requireAuthenticationWithEvent(
            props.authenticationContext, eventSlug, 'admin');

        if (!event.integrations?.yourTicketProviderEventId)
            return { success: false, error: 'No ticketing partner has been set up for this event' };

        // TODO: Support Weeztix once we start importing data?

        const affectedRows = await db.update(tYourTicketProviderPurchases)
            .set({
                ytpPurchaseItemHolder: '(anonymized)',
            })
            .where(tYourTicketProviderPurchases.ytpPurchaseItemHolder.isNotNull())
                .and(tYourTicketProviderPurchases.ytpPurchaseComplimentary.equals(/* false= */ 0))
                .and(tYourTicketProviderPurchases.ytpPurchaseEventId.equals(
                    event.integrations.yourTicketProviderEventId))
            .executeUpdate();

        LogBuilder.for('AnonymizeVisitorTickets')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withSeverity('Error')
            .record({
                event: event.shortName
            });

        return {
            success: true,
            message: 'All visitor tickets have been anonymized.',
        };
    });
}

/**
 * Data that needs to be available to update an event's cover image.
 */
const kChangeEventImageData = z.object({
    imageData: z.string().nonempty(),
});

/**
 * Server Action through which an event's cover image can be updated.
 */
export async function changeEventImage(eventSlug: string, formData: unknown) {
    return executeServerAction(formData, kChangeEventImageData, async (data, props) => {
        const { event } = await requireAuthenticationWithEvent(
            props.authenticationContext, eventSlug, 'event.settings');

        const eventIdentityId = await storeBlobData({
            bytes: Buffer.from(data.imageData, 'base64'),
            mimeType: 'image/png',
            type: kFileType.EventIdentity,
        });

        if (eventIdentityId === false)
            return { success: false, error: 'The event image could not be stored.' };

        const affectedRows = await db.update(tEvents)
            .set({ eventIdentityId })
            .where(tEvents.eventId.equals(event.id))
            .executeUpdate();

        await invalidateEventCache(event.id);

        LogBuilder.for('UpdateEventImage')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withSeverity('Error')
            .record({
                event: event.shortName,
            });

        return { success: true };
    });
}

/**
 * Data that needs to be available to update an event's URL-safe slug.
 */
const kChangeEventSlugData = z.object({
    slug: z.string().nonempty().regex(/^[A-Za-z0-9\-_.~]+$/, {
        message: 'The slug must only contain URL-safe characters.',
    }),
});

/**
 * Server Action through which an event's URL-safe slug can be updated.
 */
export async function changeEventSlug(existingEventSlug: string, formData: unknown) {
    return executeServerAction(formData, kChangeEventSlugData, async (data, props) => {
        const { event } = await requireAuthenticationWithEvent(
            props.authenticationContext, existingEventSlug, 'event.settings');

        const possibleDuplicatedSlugEvent = await getEvent(data.slug);
        if (!!possibleDuplicatedSlugEvent) {
            return {
                success: false,
                error: `${possibleDuplicatedSlugEvent.shortName} already uses this slug.`
            };
        }

        const affectedRows = await db.update(tEvents)
            .set({
                eventSlug: data.slug,
            })
            .where(tEvents.eventId.equals(event.id))
                .and(tEvents.eventSlug.equals(existingEventSlug))
            .executeUpdate();

        await invalidateEventCache(event.id);
        await invalidateEventCache(event.slug);

        // Active events in the navigation area now has to consider that the |event|'s slug, and
        // thus URL, may have changed.
        Cache.getInstance('AdminNavigationActiveEvents').clear();

        LogBuilder.for('UpdateEventSlug')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withSeverity('Error')
            .record({
                event: event.shortName,
                oldSlug: event.slug,
                newSlug: data.slug,
            });

        return { success: true };
    });
}

/**
 * Server Action through which an event can be published or unpublished.
 */
export async function publishEvent(eventSlug: string) {
    return executeServerAction({ /* none */ }, z.object(), async (data, props) => {
        const { event } = await requireAuthenticationWithEvent(
            props.authenticationContext, eventSlug, 'event.settings');

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
            props.authenticationContext, eventSlug, 'event.settings');

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
            props.authenticationContext, eventSlug, 'event.settings');

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
    yourTicketProviderEventId: z.number().nullish(),
    yourTicketProviderExternalEventId: z.string().nullish(),
    weeztixEventGuid: z.string().nullish(),
});

/**
 * Server Action through which an event's integrations can be updated.
 */
export async function updateEventIntegrations(eventSlug: string, formData: unknown) {
    return executeServerAction(formData, kEventIntegrationsData, async (data, props) => {
        const { event } = await requireAuthenticationWithEvent(
            props.authenticationContext, eventSlug, 'event.settings');

        const affectedRows = await db.update(tEvents)
            .set({
                eventFestivalId: data.festivalId,
                eventHotelRoomForm: data.hotelRoomForm,
                eventYtpEventId: data.yourTicketProviderEventId,
                eventYtpExternalEventId: data.yourTicketProviderExternalEventId,
                eventWeeztixGuid: data.weeztixEventGuid,
            })
            .where(tEvents.eventId.equals(event.id))
            .executeUpdate();

        await invalidateEventCache(event.id);

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

/**
 * Data that needs to be available to update an event's ticketing settings.
 */
const kEventTicketingData = z.object({
    provider: z.enum(kEventTicketProvider).or(z.literal('')),
    volunteerTicketId: z.string().optional(),
    autoGrant: z.literal([ 0, 1 ]).optional(),
    autoRevoke: z.literal([ 0, 1 ]).optional(),
});

/**
 * Server Action through which an event's ticketing settings can be updated.
 */
export async function updateEventTicketing(eventSlug: string, formData: unknown) {
    return executeServerAction(formData, kEventTicketingData, async (data, props) => {
        const { event } = await requireAuthenticationWithEvent(
            props.authenticationContext, eventSlug, 'event.settings');

        const ticketsProvider = data.provider || null;
        const ticketsAutoGrantTicketId = ticketsProvider ? (data.volunteerTicketId || null) : null;
        const ticketsAutoGrantEnabled = (ticketsAutoGrantTicketId && data.autoGrant) ? 1 : 0;
        const ticketsAutoRevokeEnabled = (ticketsAutoGrantTicketId && data.autoRevoke) ? 1 : 0;

        const affectedRows = await db.update(tEvents)
            .set({
                ticketsAutoGrantEnabled,
                ticketsAutoGrantTicketId,
                ticketsAutoRevokeEnabled,
                ticketsProvider,
            })
            .where(tEvents.eventId.equals(event.id))
            .executeUpdate();

        await invalidateEventCache(event.id);

        LogBuilder.for('UpdateEventSettings')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .record({
                event: event.shortName,
                type: 'ticketing',
            });

        return {
            success: true,
            refresh: true,  // menu items and form options might change
        };
    });
}
