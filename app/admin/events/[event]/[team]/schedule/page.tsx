// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import Alert from '@mui/material/Alert';
import HistoryIcon from '@mui/icons-material/History';
import Paper from '@mui/material/Paper';

import type { Mutation } from '@lib/database/Types';
import { ExpandableSection } from '@app/admin/components/ExpandableSection';
import { ScheduleContextImpl } from './ScheduleContext';
import { ScheduleHistoryTable } from './ScheduleHistoryTable';
import { ScheduleImpl } from './ScheduleImpl';
import { createDataSource, withContext, withRowModel } from '@app/admin/components/DataTable';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { formatDate } from '@lib/Temporal';
import { readUserSettings } from '@lib/UserSettings';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';
import db, { tSchedule, tScheduleLogs, tShifts, tUsers } from '@lib/database';

import { kEventTransformer, kTeamTransformer } from '@app/admin/components/DataTable';
import { kMutation } from '@lib/database/Types';

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
        case kMutation.Created:
            return `Created a new shift for ${mutation.afterUser}`;

        case kMutation.Deleted:
            return `Removed a ${beforeShiftName} shift for ${mutation.beforeUser}`;

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
 * Data source for recent changes made to a team's schedule.
 */
const scheduleHistoryDataSource =
    createDataSource('admin/event/team/schedule/history', withContext({
        /**
         * Event for which the schedule history should be obtained.
         */
        event: kEventTransformer,

        /**
         * Team for which the schedule history should be obtained.
         */
        team: kTeamTransformer,

        /**
         * Optional ID of the scheduled shift for which history should be shown.
         */
        scheduleId: z.number().optional(),

    }), withRowModel({
        /**
         * Unique ID of the history entry as it exists in the database.
         */
        id: z.number(),

        /**
         * Date and time at which the mutation was made, in UTC.
         */
        date: z.string(),

        /**
         * User who made this mutation.
         */
        user: z.object({
            id: z.number(),
            name: z.string(),
        }),

        /**
         * The mutation that happened, formatted as a human-readable string.
         */
        mutation: z.string(),

    }), {
        async authorize(operation, props, context) {
            executeAccessCheck(props.authenticationContext, {
                permission: 'volunteers.schedules',
                operation: 'read',
                scope: {
                    event: context.event.slug,
                    team: context.team.slug,
                },
            });
        },

        async list(params, props, context) {
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
                .where(tScheduleLogs.eventId.equals(context.event.id))
                    .and(tScheduleLogs.scheduleId.equalsIfValue(context.scheduleId))
                    .and(shiftsJoin.teamId.equals(context.team.id)
                        .or(tSchedule.shiftId.isNull()))
                .select({
                    id: tScheduleLogs.mutationId,
                    date: dbInstance.dateTimeAsString(tScheduleLogs.mutationDate),
                    user: {
                        id: tUsers.userId,
                        name: tUsers.name,
                    },

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
                .limit(params.page.limit)
                    .offset(params.page.offset)
                .executeSelectPage();

            return {
                rowCount: mutations.count,
                rows: mutations.data.map(mutation => ({
                    id: mutation.id,
                    date: mutation.date,
                    user: mutation.user,
                    mutation: formatMutation(mutation, context.event.timeZone),
                })),
            };
        },
    });

export type ScheduleHistoryDataSource = typeof scheduleHistoryDataSource;

/**
 * Data validation type for user-specific section expand settings.
 */
const kExpandSection = z.record(z.string(), z.boolean());

/**
 * The Schedule page enables leads to build the comprehensive schedules defining where volunteers
 * will be helping out throughout the event. This is one of the most complex pages in our app, which
 * relies on the timeline component as well as data from many different sources.
 */
export default async function EventTeamSchedulePage(
    props: PageProps<'/admin/events/[event]/[team]/schedule'>)
{
    const { access, event, team, user } = await verifyAccessAndFetchPageInfo(props.params);
    if (!access.can('volunteers.schedules', 'read', { event: event.slug, team: team.slug }))
        notFound();

    if (!team.flagEnableScheduling)
        notFound();

    const userSettings = await readUserSettings(user.id, [
        'user-admin-schedule-date',
        'user-admin-schedule-expand-sections',
        'user-admin-schedule-expand-history',
        'user-admin-schedule-expand-warnings',
        'user-admin-schedule-highlight-shifts',
        'user-admin-schedule-inclusive-shifts',
    ]);

    const defaultContext = {
        date: userSettings['user-admin-schedule-date'],
        highlightedShifts: userSettings['user-admin-schedule-highlight-shifts'],
        inclusiveShifts: userSettings['user-admin-schedule-inclusive-shifts'] ?? false,
    };

    const readOnly =
        !access.can('volunteers.schedules', 'update', { event: event.slug, team: team.slug });

    let sections: z.infer<typeof kExpandSection> = {};
    try {
        const unverifiedSections =
            JSON.parse(userSettings['user-admin-schedule-expand-sections'] ?? '{}');

        // Only populate the `settings` when it's both valid JSON, and validates per
        // `kExpandSection`. This avoid type violations in runtime.
        sections = kExpandSection.parse(unverifiedSections);

    } catch (error: any) {
        console.warn(`User ${user.id} has invalid section expand configuration`, error);
    }

    // ---------------------------------------------------------------------------------------------

    return (
        <>
            { !!readOnly &&
                <Paper component={Alert} severity="warning">
                    Please ask your Staff member to add you to the scheduling team if you would like
                    to be able to make any changes.
                </Paper> }
            <ScheduleContextImpl event={event} team={team} defaultContext={defaultContext}>

                <ScheduleImpl readOnly={readOnly} sections={sections}
                              historyContext={{ event: event.slug, team: team.slug }}
                              historySource={scheduleHistoryDataSource} />

                <ExpandableSection
                    defaultExpanded={ !!userSettings['user-admin-schedule-expand-history'] }
                    title="Recent changes" icon={ <HistoryIcon color="info" /> }
                    setting="user-admin-schedule-expand-history">

                    <ScheduleHistoryTable
                        context={{ event: event.slug, team: team.slug }}
                        source={scheduleHistoryDataSource} />

                </ExpandableSection>

                { /* TODO: Add a section displaying warnings */ }

            </ScheduleContextImpl>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Schedule', { team: 'team' }, { event: 'event' });
