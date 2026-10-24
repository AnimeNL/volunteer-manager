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
 * The data associated with a refund configuration update.
 */
const kRefundConfigurationData = z.object({
    /**
     * Whether refund information should be published on the registration portal.
     */
    refundInformationPublished: z.coerce.number(),

    /**
     * Moment in time, if any, at which we'll start to accept refund requests.
     */
    refundRequestsStart: kTemporalZonedDateTime.nullish(),

    /**
     * Moment in time, if any, at which we'll no longer accept refund requests.
     */
    refundRequestsEnd: kTemporalZonedDateTime.nullish(),
});

/**
 * Server Action that will be invoked when the refund configuration is being updated by a senior
 * volunteer. Synchronises the state update request with the database.
 */
export async function updateRefundConfiguration(eventSlug: string, formData: unknown) {
    return executeServerAction(formData, kRefundConfigurationData, async (data, props) => {
        const { event } = await requireAuthenticationWithEvent(
            props.authenticationContext, eventSlug, 'volunteers.refunds');

        if (!event.flags.enableRefunds)
            notFound();

        const affectedRows = await db.update(tEvents)
            .set({
                refundInformationPublished: data.refundInformationPublished,
                refundRequestsStart: data.refundRequestsStart,
                refundRequestsEnd: data.refundRequestsEnd,
            })
            .where(tEvents.eventId.equals(event.id))
            .executeUpdate();

        LogBuilder.for('UpdateEventPublishedInformation')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withSeverity('Warning')
            .record({
                event: event.shortName,
                published: !!data.refundInformationPublished,
                type: 'refund',
            });

        return { success: true };
    });
}
