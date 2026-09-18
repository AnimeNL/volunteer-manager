// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import type { ActionProps } from '../../../Action';
import type { ApiDefinition, ApiRequest, ApiResponse } from '@app/api/Types';
import { getEventBySlug } from '@lib/EventLoader';
import db, { tSchedule, tScheduleLogs } from '@lib/database';

import { kMutation } from '@lib/database/Types';

/**
 * Type that describes the schedule entry that should be deleted.
 */
export const kDeleteScheduleEntryDefinition = z.object({
    request: z.object({
        /**
         * URL-safe slug of the event for which the schedule is being updated.
         */
        event: z.string(),

        /**
         * URL-safe slug of the team for which the schedule is being updated.
         */
        team: z.string(),

        /**
         * Unique ID of the schedule entry that should be deleted.
         */
        id: z.array(z.string()),
    }),
    response: z.strictObject({
        /**
         * Whether the schedule could be updated successfully.
         */
        success: z.boolean(),

        /**
         * Error message in case the schedule could not be updated.
         */
        error: z.string().optional(),
    }),
});

export type DeleteScheduleEntryDefinition = ApiDefinition<typeof kDeleteScheduleEntryDefinition>;

type Request = ApiRequest<typeof kDeleteScheduleEntryDefinition>;
type Response = ApiResponse<typeof kDeleteScheduleEntryDefinition>;

/**
 * API that allows leaders to delete a schedule entry.
 */
export async function deleteScheduleEntry(request: Request, props: ActionProps): Promise<Response> {
    if (
        !props.user ||
        !props.access.can(
            'volunteers.schedules', 'update', { event: request.event, team: request.team }))
    {
        notFound();
    }

    if (request.id.length !== 1)
        notFound();  // invalid request

    const id = parseInt(request.id[0] as string, 10);

    // TODO: Figure out if we need to handle this case, and if so, how. We might need to match the
    // shift's timings against a newly created shift in the database.
    if (Number.isNaN(id))
        return { success: false, error: 'The selected shift has not been saved yet' };

    const event = await getEventBySlug(request.event);
    if (!event)
        notFound();

    const dbInstance = db;
    const scheduledShift = await dbInstance.selectFrom(tSchedule)
        .where(tSchedule.scheduleId.equals(id))
            .and(tSchedule.eventId.equals(event.id))
        .select({
            shiftId: tSchedule.shiftId,
            timeStart: tSchedule.scheduleTimeStart,
            timeEnd: tSchedule.scheduleTimeEnd,
            userId: tSchedule.userId,
        })
        .executeSelectNoneOrOne();

    if (!scheduledShift)
        notFound();

    const affectedRows = await dbInstance.transaction(async () => {
        const affectedRows = await dbInstance.update(tSchedule)
            .set({
                scheduleDeleted: db.currentZonedDateTime()
            })
            .where(tSchedule.scheduleId.equals(id))
                .and(tSchedule.eventId.equals(event.id))
            .executeUpdate();

        if (!!affectedRows) {
            await dbInstance.insertInto(tScheduleLogs)
                .set({
                    eventId: event.id,
                    scheduleId: id,
                    mutation: kMutation.Deleted,
                    mutationBeforeShiftId: scheduledShift.shiftId,
                    mutationBeforeTimeStart: scheduledShift.timeStart,
                    mutationBeforeTimeEnd: scheduledShift.timeEnd,
                    mutationBeforeUserId: scheduledShift.userId,
                    mutationUserId: props.user!.id,
                })
                .executeInsert();
        }

        return affectedRows;
    });

    return { success: !!affectedRows };
}
