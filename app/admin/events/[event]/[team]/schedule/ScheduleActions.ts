// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { executeServerAction } from '@lib/serverAction';
import { isAfter } from '@lib/Temporal';
import { isValidShift } from '@app/api/admin/event/schedule/fn/isValidShift';
import { requireAuthentication, requireAuthenticationWithEventAndTeam }
    from '@lib/requireAuthentication';
import { writeUserSettings } from '@lib/UserSettings';
import db, { tSchedule, tScheduleLogs, tUsersEvents, tUsersEventsPreferencesAvailability }
    from '@lib/database';

import { kMutation, kRegistrationStatus } from '@lib/database/Types';
import { kTemporalZonedDateTime } from '@app/admin/lib/ZodTransformers';

/**
 * Zod schema describing the shift payload for creating or updating a schedule entry.
 */
const kScheduleShiftData = z.object({
    /**
     * User ID of the volunteer to whom the shift belongs.
     */
    userId: z.number(),

    /**
     * Unique ID of the defined shift, as it exists in the database.
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
});

/**
 * Server Action that allows leaders to create a new schedule entry.
 */
export async function createScheduleEntry(eventSlug: string, teamSlug: string, shiftData: unknown) {
    return executeServerAction(shiftData, kScheduleShiftData, async (shift, props) => {
        const { event, team, user } = await requireAuthenticationWithEventAndTeam(
            props.authenticationContext, eventSlug, teamSlug, {
                permission: 'volunteers.schedules',
                operation: 'update',
            });

        if (!isAfter(shift.end, shift.start)) {
            return {
                success: false,
                error: 'The shift ends before it starts. Please tell Peter how you did this!',
            };
        }

        const availabilityPreferencesJoin = tUsersEventsPreferencesAvailability.forUseInLeftJoin();

        const dbInstance = db;
        const volunteer = await dbInstance.selectFrom(tUsersEvents)
            .leftJoin(availabilityPreferencesJoin)
                .on(availabilityPreferencesJoin.userId.equals(tUsersEvents.userId))
                    .and(availabilityPreferencesJoin.eventId.equals(tUsersEvents.eventId))
                    .and(availabilityPreferencesJoin.teamId.equals(tUsersEvents.teamId))
                    .and(availabilityPreferencesJoin.preferenceVersionIsLatest.equals(/* true= */ 1))
            .where(tUsersEvents.userId.equals(shift.userId))
                .and(tUsersEvents.eventId.equals(event.id))
                .and(tUsersEvents.teamId.equals(team.id))
                .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
            .select({
                id: tUsersEvents.userId,
                availabilityExceptions: availabilityPreferencesJoin.availabilityExceptions,
                availabilityTimeslots: availabilityPreferencesJoin.availabilityTimeslots,
            })
            .executeSelectNoneOrOne();

        if (!volunteer)
            return { success: false, error: 'The selected volunteer is not part of this team' };

        const valid = await isValidShift(event, volunteer, shift);
        if (!valid) {
            return {
                success: false,
                error: 'Cannot schedule a shift at that time for the volunteer',
            };
        }

        await dbInstance.transaction(async () => {
            const scheduleId = await dbInstance.insertInto(tSchedule)
                .set({
                    userId: volunteer.id,
                    eventId: event.id,
                    shiftId: shift.shiftId,
                    scheduleTimeStart: shift.start,
                    scheduleTimeEnd: shift.end,
                    scheduleUpdatedBy: user.id,
                    scheduleUpdated: dbInstance.currentZonedDateTime(),
                })
                .returningLastInsertedId()
                .executeInsert();

            await dbInstance.insertInto(tScheduleLogs)
                .set({
                    eventId: event.id,
                    scheduleId,
                    mutation: kMutation.Created,
                    mutationAfterShiftId: shift.shiftId,
                    mutationAfterTimeStart: shift.start,
                    mutationAfterTimeEnd: shift.end,
                    mutationAfterUserId: volunteer.id,
                    mutationUserId: user.id,
                })
                .executeInsert();
        });

        return { success: true };
    });
}

/**
 * Zod schema describing the schedule entry ID to delete.
 */
const kDeleteScheduleEntryData = z.object({
    id: z.union([ z.number(), z.string() ]),
});

/**
 * Server Action that allows leaders to delete a schedule entry.
 */
export async function deleteScheduleEntry(
    eventSlug: string, teamSlug: string, id: number | string)
{
    return executeServerAction({ id }, kDeleteScheduleEntryData, async (data, props) => {
        const { event, user } = await requireAuthenticationWithEventAndTeam(
            props.authenticationContext, eventSlug, teamSlug, {
                permission: 'volunteers.schedules',
                operation: 'update',
            });

        const scheduleId = typeof data.id === 'number' ? data.id : parseInt(data.id, 10);
        if (!Number.isSafeInteger(scheduleId))
            return { success: false, error: 'The selected shift has not been saved yet' };

        const dbInstance = db;
        const scheduledShift = await dbInstance.selectFrom(tSchedule)
            .where(tSchedule.scheduleId.equals(scheduleId))
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
                    scheduleDeleted: dbInstance.currentZonedDateTime(),
                })
                .where(tSchedule.scheduleId.equals(scheduleId))
                    .and(tSchedule.eventId.equals(event.id))
                .executeUpdate();

            if (!!affectedRows) {
                await dbInstance.insertInto(tScheduleLogs)
                    .set({
                        eventId: event.id,
                        scheduleId,
                        mutation: kMutation.Deleted,
                        mutationBeforeShiftId: scheduledShift.shiftId,
                        mutationBeforeTimeStart: scheduledShift.timeStart,
                        mutationBeforeTimeEnd: scheduledShift.timeEnd,
                        mutationBeforeUserId: scheduledShift.userId,
                        mutationUserId: user.id,
                    })
                    .executeInsert();
            }

            return affectedRows;
        });

        return { success: !!affectedRows };
    });
}

/**
 * Zod schema describing the data for updating a schedule entry.
 */
const kUpdateScheduleEntryData = z.object({
    id: z.union([ z.number(), z.string() ]),
    shift: kScheduleShiftData,
});

/**
 * Server Action that allows leaders to update a schedule entry.
 */
export async function updateScheduleEntry(
    eventSlug: string, teamSlug: string, id: number | string, shiftData: unknown)
{
    return executeServerAction(
        { id, shift: shiftData }, kUpdateScheduleEntryData, async (data, props) =>
    {
        const { event, team, user } = await requireAuthenticationWithEventAndTeam(
            props.authenticationContext, eventSlug, teamSlug, {
                permission: 'volunteers.schedules',
                operation: 'update',
            });

        const scheduleId = typeof data.id === 'number' ? data.id : parseInt(data.id, 10);
        if (!Number.isSafeInteger(scheduleId))
            return { success: false, error: 'The selected shift has not been saved yet' };

        const dbInstance = db;
        const shift = await dbInstance.selectFrom(tSchedule)
            .where(tSchedule.scheduleId.equals(scheduleId))
                .and(tSchedule.eventId.equals(event.id))
                .and(tSchedule.scheduleDeleted.isNull())
            .select({
                userId: tSchedule.userId,
                shiftId: tSchedule.shiftId,
                start: tSchedule.scheduleTimeStart,
                end: tSchedule.scheduleTimeEnd,
            })
            .executeSelectNoneOrOne();

        if (!shift)
            return { success: false, error: 'The selected shift does not exist anymore' };

        const availabilityPreferencesJoin = tUsersEventsPreferencesAvailability.forUseInLeftJoin();

        const volunteer = await dbInstance.selectFrom(tUsersEvents)
            .leftJoin(availabilityPreferencesJoin)
                .on(availabilityPreferencesJoin.userId.equals(tUsersEvents.userId))
                    .and(availabilityPreferencesJoin.eventId.equals(tUsersEvents.eventId))
                    .and(availabilityPreferencesJoin.teamId.equals(tUsersEvents.teamId))
                    .and(availabilityPreferencesJoin.preferenceVersionIsLatest.equals(/* true= */ 1))
            .where(tUsersEvents.userId.equals(data.shift.userId))
                .and(tUsersEvents.eventId.equals(event.id))
                .and(tUsersEvents.teamId.equals(team.id))
                .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
            .select({
                id: tUsersEvents.userId,
                availabilityExceptions: availabilityPreferencesJoin.availabilityExceptions,
                availabilityTimeslots: availabilityPreferencesJoin.availabilityTimeslots,
            })
            .executeSelectNoneOrOne();

        if (!volunteer)
            return { success: false, error: 'The selected volunteer is not part of this team' };

        if (!isAfter(data.shift.end, data.shift.start)) {
            return {
                success: false,
                error: 'The shift ends before it starts. Please tell Peter how you did this!',
            };
        }

        const valid = await isValidShift(event, volunteer, data.shift, /* ignoreShift= */ scheduleId);
        if (!valid) {
            return {
                success: false,
                error: 'Cannot schedule a shift at that time for the volunteer',
            };
        }

        const affectedRows = await dbInstance.transaction(async () => {
            const affectedRows = await dbInstance.update(tSchedule)
                .setIfValue({
                    shiftId: data.shift.shiftId,
                })
                .set({
                    userId: data.shift.userId,
                    scheduleTimeStart: data.shift.start,
                    scheduleTimeEnd: data.shift.end,
                    scheduleUpdatedBy: user.id,
                    scheduleUpdated: dbInstance.currentZonedDateTime(),
                })
                .where(tSchedule.scheduleId.equals(scheduleId))
                    .and(tSchedule.eventId.equals(event.id))
                .executeUpdate();

            if (!!affectedRows) {
                const mutationBeforeShiftId = shift.shiftId;
                let mutationAfterShiftId: number | undefined;

                if (shift.shiftId !== data.shift.shiftId)
                    mutationAfterShiftId = data.shift.shiftId;

                let mutationBeforeTimeStart: Temporal.ZonedDateTime | undefined;
                let mutationBeforeTimeEnd: Temporal.ZonedDateTime | undefined;
                let mutationAfterTimeStart: Temporal.ZonedDateTime | undefined;
                let mutationAfterTimeEnd: Temporal.ZonedDateTime | undefined;

                if (Temporal.ZonedDateTime.compare(shift.start, data.shift.start) !== 0) {
                    mutationBeforeTimeStart = shift.start;
                    mutationAfterTimeStart = data.shift.start;
                }

                if (Temporal.ZonedDateTime.compare(shift.end, data.shift.end) !== 0) {
                    mutationBeforeTimeEnd = shift.end;
                    mutationAfterTimeEnd = data.shift.end;
                }

                const mutationBeforeUserId = shift.userId;
                let mutationAfterUserId: number | undefined;

                if (shift.userId !== data.shift.userId)
                    mutationAfterUserId = data.shift.userId;

                await dbInstance.insertInto(tScheduleLogs)
                    .set({
                        eventId: event.id,
                        scheduleId,
                        mutation: kMutation.Updated,
                        mutationBeforeShiftId,
                        mutationBeforeTimeStart,
                        mutationBeforeTimeEnd,
                        mutationBeforeUserId,
                        mutationAfterShiftId,
                        mutationAfterTimeStart,
                        mutationAfterTimeEnd,
                        mutationAfterUserId,
                        mutationUserId: user.id,
                    })
                    .executeInsert();
            }

            return affectedRows;
        });

        return { success: !!affectedRows };
    });
}

/**
 * Zod schema describing the user settings that can be persisted for the schedule tool.
 */
const kUpdateScheduleSettingsData = z.object({
    date: z.string().optional(),
    expandSections: z.string().optional(),
    inclusiveShifts: z.boolean().optional(),
});

/**
 * Server Action through which user settings for the schedule tool can be persisted.
 */
export async function updateScheduleSettings(
    settings: z.infer<typeof kUpdateScheduleSettingsData>)
{
    return executeServerAction(settings, kUpdateScheduleSettingsData, async (data, props) => {
        await requireAuthentication(props.authenticationContext);

        const updates: Record<string, string | boolean | undefined> = {};
        if (data.date !== undefined)
            updates['user-admin-schedule-date'] = data.date;
        if (data.expandSections !== undefined)
            updates['user-admin-schedule-expand-sections'] = data.expandSections;
        if (data.inclusiveShifts !== undefined)
            updates['user-admin-schedule-inclusive-shifts'] = data.inclusiveShifts;

        if (Object.keys(updates).length > 0)
            await writeUserSettings(props.user.id, updates as any);

        return { success: true };
    });
}
