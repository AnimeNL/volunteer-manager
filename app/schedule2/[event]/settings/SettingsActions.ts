// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { z } from 'zod/v4';

import { executeServerAction } from '@lib/serverAction';
import { requireVolunteerAuthenticationWithEvent } from '@lib/auth';
import { writeUserSetting } from '@lib/UserSettings';

/**
 * Zod schema describing the data accepted by `updateScheduleTimeOffset`.
 */
const kUpdateScheduleTimeOffsetData = z.object({
    dateTime: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/).nullable(),
    event: z.string(),
});

/**
 * Server Action persisting or clearing the signed-in developer's per-user schedule clock offset.
 */
export async function updateScheduleTimeOffset(event: string, dateTime: string | null) {
    return executeServerAction(
        { dateTime, event }, kUpdateScheduleTimeOffsetData, async (data, props) =>
    {
        const { event } = await requireVolunteerAuthenticationWithEvent(
            props.authenticationContext, data.event, 'event.settings');

        if (data.dateTime === null) {
            await writeUserSetting(props.user.id, 'user-schedule-time-offset-seconds', undefined);
            return { success: true };
        }

        const targetTime =
            Temporal.PlainDateTime.from(data.dateTime).toZonedDateTime(event.timeZone);
        const offsetSeconds = Math.round(
            (targetTime.epochMilliseconds - Temporal.Now.instant().epochMilliseconds) / 1000);

        await writeUserSetting(props.user.id, 'user-schedule-time-offset-seconds', offsetSeconds);
        return { success: true };
    });
}
