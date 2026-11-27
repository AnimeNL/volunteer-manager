// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { z } from 'zod/v4';

import { executeServerAction } from '@lib/serverAction';
import { requireVolunteerAuthenticationWithEvent } from '@lib/auth';
import { writeUserSetting } from '@lib/UserSettings';

/**
 * Zod transformer validating that the input conforms to `Temporal.PlainDateTime` constraints,
 * matching the pattern in `app/admin/lib/ZodTransformers.ts`.
 */
const kTemporalPlainDateTime = z.string().transform((value, context) => {
    try {
        return Temporal.PlainDateTime.from(value);
    } catch (error: any) {
        context.addIssue({
            code: 'custom',
            message: `Only plain date-times are accepted (YYYY-MM-DDTHH:mm), got "${value}"`,
            _error: error,
        });
    }

    return z.NEVER;
});

/**
 * Zod schema describing the data accepted by `updateScheduleTimeOffset`.
 */
const kUpdateScheduleTimeOffsetData = z.object({
    dateTime: kTemporalPlainDateTime.nullable(),
    event: z.string().nonempty(),
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

        const offsetSeconds = data.dateTime !== null
            ? Math.round(
                (data.dateTime.toZonedDateTime(event.timeZone).epochMilliseconds -
                    Temporal.Now.instant().epochMilliseconds) / 1000)
            : undefined;

        await writeUserSetting(props.user.id, 'user-schedule-time-offset-seconds', offsetSeconds);
        return { success: true };
    });
}
