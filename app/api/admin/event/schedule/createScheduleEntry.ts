// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import type { ActionProps } from '../../../Action';
import type { ApiDefinition, ApiRequest, ApiResponse } from '@app/api/Types';
import { getEventBySlug } from '@lib/EventLoader';
import { isAfter } from '@lib/Temporal';
import { isValidShift } from './fn/isValidShift';
import db, { tSchedule, tScheduleLogs, tTeams, tUsersEvents, tUsersEventsPreferencesAvailability }
    from '@lib/database';

import { kMutation, kRegistrationStatus } from '@lib/database/Types';
import { kTemporalZonedDateTime } from '@app/api/Types';

/**
 * Type that describes the schedule entry that should be created.
 */
export const kCreateScheduleEntryDefinition = z.object({
    request: z.object({
        /**
         * URL-safe slug of the event for which the schedule is being retrieved.
         */
        event: z.string(),

        /**
         * URL-safe slug of the team for which the schedule is being retrieved.
         */
        team: z.string(),

        /**
         * The shift that should be created.
         */
        shift: z.object({
            /**
             * User for whom the shift is being added.
             */
            userId: z.number(),

            /**
             * Unique ID of the defined shift, as it exists in the database. Only applicable for
             * shifts that have been copy/pasted.
             */
            shiftId: z.number().optional(),

            /**
             * Time at which the shift will start.
             */
            start: kTemporalZonedDateTime,

            /**
             * Time at which the shift will finish.
             */
            end: kTemporalZonedDateTime,
        }),
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

export type CreateScheduleEntryDefinition = ApiDefinition<typeof kCreateScheduleEntryDefinition>;

type Request = ApiRequest<typeof kCreateScheduleEntryDefinition>;
type Response = ApiResponse<typeof kCreateScheduleEntryDefinition>;

/**
 * API that allows leaders to create a new schedule entry.
 */
export async function createScheduleEntry(request: Request, props: ActionProps): Promise<Response> {
    if (
        !props.user ||
        !props.access.can(
            'event.schedule.planning', 'update', { event: request.event, team: request.team }))
    {
        notFound();
    }

    const event = await getEventBySlug(request.event);
    if (!event)
        notFound();

    if (!isAfter(request.shift.end, request.shift.start)) {
        return {
            success: false,
            error: 'The shift ends before it starts. Please tell Peter how you did this!'
        };
    }

    const availabilityPreferencesJoin = tUsersEventsPreferencesAvailability.forUseInLeftJoin();

    const volunteer = await db.selectFrom(tUsersEvents)
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tUsersEvents.teamId))
        .leftJoin(availabilityPreferencesJoin)
            .on(availabilityPreferencesJoin.userId.equals(tUsersEvents.userId))
                .and(availabilityPreferencesJoin.eventId.equals(tUsersEvents.eventId))
                .and(availabilityPreferencesJoin.teamId.equals(tUsersEvents.teamId))
                .and(availabilityPreferencesJoin.preferenceVersionIsLatest.equals(/* true= */ 1))
        .where(tUsersEvents.userId.equals(request.shift.userId))
            .and(tUsersEvents.eventId.equals(event.id))
            .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
        .select({
            id: tUsersEvents.userId,

            teamSlug: tTeams.teamSlug,

            availabilityExceptions: availabilityPreferencesJoin.availabilityExceptions,
            availabilityTimeslots: availabilityPreferencesJoin.availabilityTimeslots,
        })
        .executeSelectNoneOrOne();

    if (!volunteer || volunteer.teamSlug !== request.team)
        return { success: false, error: 'The selected volunteer is not part of this team' };

    const valid = await isValidShift(event, volunteer, request.shift);
    if (!valid)
        return { success: false, error: 'Cannot schedule a shift at that time for the volunteer' };

    const dbInstance = db;
    await dbInstance.transaction(async () => {
        const scheduleId = await dbInstance.insertInto(tSchedule)
            .set({
                userId: volunteer.id,
                eventId: event.id,
                shiftId: request.shift.shiftId,
                scheduleTimeStart: request.shift.start,
                scheduleTimeEnd: request.shift.end,
                scheduleUpdatedBy: props.user!.id,
                scheduleUpdated: dbInstance.currentZonedDateTime()
            })
            .returningLastInsertedId()
            .executeInsert();

        await dbInstance.insertInto(tScheduleLogs)
            .set({
                eventId: event.id,
                scheduleId,
                mutation: kMutation.Created,
                mutationAfterShiftId: request.shift.shiftId,
                mutationAfterTimeStart: request.shift.start,
                mutationAfterTimeEnd: request.shift.end,
                mutationAfterUserId: volunteer.id,
                mutationUserId: props.user!.id,
            })
            .executeInsert();
    });

    return { success: true };
}
