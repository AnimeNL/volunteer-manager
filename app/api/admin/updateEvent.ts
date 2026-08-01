// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import type { ActionProps } from '../Action';
import type { ApiDefinition, ApiRequest, ApiResponse } from '../Types';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { getEventBySlug } from '@lib/EventLoader';
import { storeBlobData } from '@lib/database/BlobStore';
import db, { tEvents } from '@lib/database';

import { kFileType } from '@lib/database/Types';

/**
 * Interface definition for the Event API, exposed through /api/admin/update-event.
 */
export const kUpdateEventDefinition = z.object({
    request: z.object({
        /**
         * Slug of the event that should be updated.
         */
        event: z.string(),

        /**
         * The event identity image, encoded in the PNG format, represented as a string.
         */
        eventIdentity: z.string().optional(),

        /**
         * The updated event slug that this event should be changed to.
         */
        eventSlug: z.string().optional(),
    }),
    response: z.strictObject({
        /**
         * Whether the event could be updated successfully.
         */
        success: z.boolean(),

        /**
         * The new slug, if it were successfully updated in the database.
         */
        slug: z.string().optional(),
    }),
});

export type UpdateEventDefinition = ApiDefinition<typeof kUpdateEventDefinition>;

type Request = ApiRequest<typeof kUpdateEventDefinition>;
type Response = ApiResponse<typeof kUpdateEventDefinition>;

/**
 * API that allows administrators to update information related to an event, or the teams that do
 * participate in an event. Only event administrators have the rights to use this page.
 */
export async function updateEvent(request: Request, props: ActionProps): Promise<Response> {
    executeAccessCheck(props.authenticationContext, {
        check: 'admin-event',
        event: request.event,
        permission: {
            permission: 'event.settings',
            scope: {
                event: request.event,
            },
        },
    });

    const event = await getEventBySlug(request.event);
    if (!event)
        notFound();

    if (request.eventIdentity !== undefined) {
        const eventIdentityId = await storeBlobData({
            bytes: Buffer.from(request.eventIdentity, 'base64'),
            mimeType: 'image/png',
            type: kFileType.EventIdentity,
        });

        if (eventIdentityId !== false) {
            const affectedRows = await db.update(tEvents)
                .set({ eventIdentityId })
                .where(tEvents.eventId.equals(event.eventId))
                .executeUpdate(/* min= */ 0, /* max= */ 1);

            if (!!affectedRows) {
                RecordLog({
                    type: kLogType.AdminUpdateEvent,
                    severity: kLogSeverity.Info,
                    sourceUser: props.user,
                    data: {
                        action: 'the identity image',
                        event: event.shortName,
                    },
                });
            }

            return { success: !!affectedRows };
        }

        return { success: false };
    }

    if (request.eventSlug !== undefined) {
        const otherEvent = await getEventBySlug(request.eventSlug);
        if (otherEvent)
            return { success: false };  // the new slug is already taken

        const affectedRows = await db.update(tEvents)
            .set({
                eventSlug: request.eventSlug,
            })
            .where(tEvents.eventId.equals(event.eventId))
            .executeUpdate(/* min= */ 0, /* max= */ 1);

        if (affectedRows > 0) {
            RecordLog({
                type: kLogType.AdminUpdateEvent,
                severity: kLogSeverity.Warning,
                sourceUser: props.user,
                data: {
                    action: 'the URL slug',
                    event: event.shortName,
                }
            });
        }

        return { success: !!affectedRows, slug: request.eventSlug };
    }

    return { success: false };
}
