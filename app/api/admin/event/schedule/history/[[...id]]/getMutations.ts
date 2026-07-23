// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

export interface EventScheduleHistoryRowModel {
    id: number;
    date: string;
    userId: number;
    user: string;
    mutation: string;
}
import { type Mutation, kMutation } from '@lib/database/Types';
import { formatDate } from '@lib/Temporal';
import db, { tScheduleLogs, tSchedule, tShifts, tUsers } from '@lib/database';

/**
 * Type definition of the information contained for a mutation.
 */
interface MutationInfo {
    mutation: Mutation;

    beforeShift?: string;
    beforeTimeStart?: Temporal.ZonedDateTime;
    beforeTimeEnd?: Temporal.ZonedDateTime;
    beforeUser?: string;

    afterShift?: string;
    afterTimeStart?: Temporal.ZonedDateTime;
    afterTimeEnd?: Temporal.ZonedDateTime;
    afterUser?: string;
}

/**
 * Formats the given `mutation` into a human-readable string. This considers all of the important
 * permutations that can be made to the schedule, clarifying to the reader what has changed.
 */
function formatMutation(mutation: MutationInfo, timezone: string): string {
    const beforeShiftName = mutation.beforeShift ?? 'unassigned';
    const afterShiftName = mutation.afterShift ?? 'unassigned';

    switch (mutation.mutation) {
        case kMutation.Created: {
            return `Created a new shift for ${mutation.afterUser}`;
        }
        case kMutation.Deleted: {
            return `Removed a ${beforeShiftName} shift for ${mutation.beforeUser}`;
        }
        case kMutation.Updated: {
            if (!!mutation.afterShift && mutation.beforeShift !== mutation.afterShift) {
                return `Changed a ${beforeShiftName} shift to a ${afterShiftName} shift ` +
                    `for ${mutation.afterUser ?? mutation.beforeUser}`;
            }

            if (!!mutation.afterUser && mutation.beforeUser !== mutation.afterUser) {
                return `Moved a ${beforeShiftName} shift from ${mutation.beforeUser} ` +
                    `to ${mutation.afterUser}`;
            }

            const beforeTimeStart = mutation.beforeTimeStart?.withTimeZone(timezone);
            const beforeTimeEnd = mutation.beforeTimeEnd?.withTimeZone(timezone);
            const afterTimeStart = mutation.afterTimeStart?.withTimeZone(timezone);
            const afterTimeEnd = mutation.afterTimeEnd?.withTimeZone(timezone);

            if (!!beforeTimeStart && !!afterTimeStart && !!beforeTimeEnd && !!afterTimeEnd) {
                return `Moved a ${beforeShiftName} shift for ${mutation.beforeUser} from ` +
                    `${formatDate(beforeTimeStart, 'ddd HH:mm')}–` +
                    `${formatDate(beforeTimeEnd, 'HH:mm')} to ` +
                    `${formatDate(afterTimeStart, 'ddd HH:mm')}–` +
                    `${formatDate(afterTimeEnd, 'HH:mm')}`;

            } else if (!!beforeTimeStart && !!afterTimeStart) {
                return `Changed a ${beforeShiftName} shift for ${mutation.beforeUser} to begin ` +
                    `at ${formatDate(afterTimeStart, 'HH:mm')} instead of ` +
                    `${formatDate(beforeTimeStart, 'HH:mm [on] dddd')}`;

            } else if (!!beforeTimeEnd && !!afterTimeEnd) {
                return `Changed a ${beforeShiftName} shift for ${mutation.beforeUser} to end ` +
                    `at ${formatDate(afterTimeEnd, 'HH:mm')} instead of ` +
                    `${formatDate(beforeTimeEnd, 'HH:mm [on] dddd')}`;
            }

            break;
        }
    }

    return 'Unknown mutation';
}

/**
 * Parameters accepted by the getMutations function.
 */
interface GetMutationsParams {
    /**
     * Pagination option selecting the window of mutations that should be returned.
     */
    pagination?: {
        /**
         * Page of the mutations that should be shown.
         */
        page: number;

        /**
         * Number of mutations to display per page.
         */
        pageSize: number;
    };

    /**
     * Unique ID of the scheduled shift for which history should be obtained.
     */
    scheduleId?: number;
}

/**
 * Returns the schedule mutations for the given |eventId| and |teamId|, based on the given |params|,
 * together with the total number of mutations that are available for this configuration.
 */
export async function getMutations(
    eventId: number, teamId: number, timezone: string, params: GetMutationsParams)
        : Promise<[ number, EventScheduleHistoryRowModel[] ]>
{
    const { pagination } = params;

    const beforeShiftsJoin = tShifts.forUseInLeftJoinAs('bsj');
    const afterShiftsJoin = tShifts.forUseInLeftJoinAs('asj');

    const beforeUserJoin = tUsers.forUseInLeftJoinAs('buj');
    const afterUserJoin = tUsers.forUseInLeftJoinAs('auj');

    const shiftsJoin = tShifts.forUseInLeftJoin();

    const dbInstance = db;
    const mutations = await dbInstance.selectFrom(tScheduleLogs)
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tScheduleLogs.mutationUserId))
        .innerJoin(tSchedule)
            .on(tSchedule.scheduleId.equals(tScheduleLogs.scheduleId))
        .leftJoin(beforeShiftsJoin)
            .on(beforeShiftsJoin.shiftId.equals(tScheduleLogs.mutationBeforeShiftId))
        .leftJoin(afterShiftsJoin)
            .on(afterShiftsJoin.shiftId.equals(tScheduleLogs.mutationAfterShiftId))
        .leftJoin(beforeUserJoin)
            .on(beforeUserJoin.userId.equals(tScheduleLogs.mutationBeforeUserId))
        .leftJoin(afterUserJoin)
            .on(afterUserJoin.userId.equals(tScheduleLogs.mutationAfterUserId))
        .leftJoin(shiftsJoin)
            .on(shiftsJoin.shiftId.equals(tSchedule.shiftId))
        .where(tScheduleLogs.eventId.equals(eventId))
            .and(tScheduleLogs.scheduleId.equalsIfValue(params.scheduleId))
            .and(shiftsJoin.teamId.equals(teamId)
                .or(tSchedule.shiftId.isNull()))
        .select({
            id: tScheduleLogs.mutationId,
            date: dbInstance.dateTimeAsString(tScheduleLogs.mutationDate),
            userId: tUsers.userId,
            user: tUsers.name,

            mutation: tScheduleLogs.mutation,

            beforeShift: beforeShiftsJoin.shiftName,
            beforeTimeStart: tScheduleLogs.mutationBeforeTimeStart,
            beforeTimeEnd: tScheduleLogs.mutationBeforeTimeEnd,
            beforeUser: beforeUserJoin.name,

            afterShift: afterShiftsJoin.shiftName,
            afterTimeStart: tScheduleLogs.mutationAfterTimeStart,
            afterTimeEnd: tScheduleLogs.mutationAfterTimeEnd,
            afterUser: afterUserJoin.name,
        })
        .orderBy('date', 'desc')
        .limitIfValue(pagination ? pagination.pageSize : null)
            .offsetIfValue(pagination ? pagination.page * pagination.pageSize : null)
        .executeSelectPage();

    return [
        mutations.count,
        mutations.data.map(mutation => ({
            id: mutation.id,
            date: mutation.date,
            userId: mutation.userId,
            user: mutation.user,
            mutation: formatMutation(mutation, timezone),
        }))
    ];
}
