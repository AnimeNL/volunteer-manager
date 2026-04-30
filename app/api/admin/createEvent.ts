// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import type { ActionProps } from '../Action';
import { kTemporalZonedDateTime, type ApiDefinition, type ApiRequest, type ApiResponse } from '../Types';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { getEventBySlug } from '@lib/EventLoader';
import db, { tEvents } from '@lib/database';

import { kEventAvailabilityStatus } from '@lib/database/Types';

/**
 * Interface definition for the Event API, exposed through /api/admin/create-event.
 */
export const kCreateEventDefinition = z.object({
    request: z.object({
        /**
         * Full name of the new event, including the theme. ("AnimeCon 2024: Yada yada ya")
         */
        name: z.string(),

        /**
         * Short name of the event. ("AnimeCon 2024")
         */
        shortName: z.string(),

        /**
         * URL slug through which the event can be identified. Must be unique. ("2024")
         */
        slug: z.string(),

        /**
         * Date and time at which the event will start.
         */
        startTime: kTemporalZonedDateTime,

        /**
         * Date and time at which the event will finish.
         */
        endTime: kTemporalZonedDateTime,

    }),
    response: z.strictObject({
        /**
         * Error message in case the event could not be created.
         */
        error: z.string().optional(),

        /**
         * Slug of the event as it was created in the database. Only when successful.
         */
        slug: z.string().optional(),
    }),
});

export type CreateEventDefinition = ApiDefinition<typeof kCreateEventDefinition>;

type Request = ApiRequest<typeof kCreateEventDefinition>;
type Response = ApiResponse<typeof kCreateEventDefinition>;

/**
 * API that allows administrators to create new events. This isn't a particularly frequent action
 * but one that we should be able to take rather seamlessly. Access is restricted.
 */
export async function createEvent(request: Request, props: ActionProps): Promise<Response> {
    executeAccessCheck(props.authenticationContext, {
        check: 'admin',
        permission: 'admin',
    });

    if (request.slug.length < 4 || request.slug.length > 12)
        return { error: 'The slug must be between 4 and 12 characters long.' };

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(request.slug))
        return { error: 'The slug may only contain (a-z), (0-9) and dashes.' };

    const existingEvent = await getEventBySlug(request.slug);
    if (existingEvent)
        return { error: `That slug is already in use by ${existingEvent.shortName}` };

    const insertId = await db.insertInto(tEvents)
        .set({
            eventName: request.name,
            eventShortName: request.shortName,
            eventSlug: request.slug,
            eventHidden: /* true= */ 1,
            eventTimezone: 'Europe/Amsterdam',
            eventStartTime: request.startTime,
            eventEndTime: request.endTime,
            eventTimingPublished: /* false= */ 0,
            eventAvailabilityStatus: kEventAvailabilityStatus.Unavailable,
        })
        .executeInsert();

    if (!!insertId) {
        RecordLog({
            type: kLogType.AdminEventCreate,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            data: {
                event: request.shortName,
            }
        });
    }

    return { slug: request.slug };
}
