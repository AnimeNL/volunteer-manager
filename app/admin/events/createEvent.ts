// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { z } from 'zod/v4';

import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { executeServerAction } from '@lib/serverAction';
import { getEventBySlug } from '@lib/EventLoader';
import db, { tEvents } from '@lib/database';

import { kEventAvailabilityStatus } from '@lib/database/Types';
import { kTemporalZonedDateTime } from '@app/api/Types';

/**
 * Zod type that describes the data required when creating an event.
 */
const kCreateEventData = z.object({
    name: z.string().nonempty(),
    shortName: z.string().nonempty(),
    slug: z.string().nonempty(),
    startTime: kTemporalZonedDateTime,
    endTime: kTemporalZonedDateTime,
});

/**
 * Server action that creates an event with the given `formData`.
 */
export async function createEvent(formData: unknown) {
    'use server';
    return executeServerAction(formData, kCreateEventData, async (data, props) => {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin',
            permission: 'admin',
        });

        if (data.slug.length < 4 || data.slug.length > 12)
            return { success: false, error: 'The slug must be between 4 and 12 characters long.' };

        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug))
            return { success: false, error: 'The slug may only contain (a-z), (0-9) and dashes.' };

        const existingEvent = await getEventBySlug(data.slug);
        if (existingEvent) {
            return {
                success: false,
                error: `That slug is already used by ${existingEvent.shortName}`
            };
        }

        const insertId = await db.insertInto(tEvents)
            .set({
                eventName: data.name,
                eventShortName: data.shortName,
                eventSlug: data.slug,
                eventHidden: /* true= */ 1,
                eventTimezone: 'Europe/Amsterdam',
                eventStartTime: data.startTime,
                eventEndTime: data.endTime,
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
                    event: data.shortName,
                }
            });
        }

        return {
            success: true,
            redirect: `/admin/events/${data.slug}/settings`,
        };
    });
}
