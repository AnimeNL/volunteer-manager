// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden, notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { type DataTableEndpoints, createDataTableApi } from '@app/api/createDataTableApi';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { getEventBySlug } from '@lib/EventLoader';
import { requireAuthentication } from '@app/admin/lib/requireAuthentication';
import db, { tActivities, tEventsTeams, tShifts, tUsers } from '@lib/database';

/**
 * Row model for an individual program request.
 */
const kProgramRequestRowModel = z.object({
    /**
     * Unique ID assigned to this request.
     */
    id: z.number(),

    /**
     * The activity for which help has been requested.
     */
    activity: z.string(),

    /**
     * Status of the program request. All requests must be manually verified by one of our leads.
     */
    status: z.enum([ 'Unknown', 'Contacted', 'Scheduled' ]),

    /**
     * The person to whom the request has been assigned, if anyone.
     */
    assignee: z.string().optional(),

    /**
     * Internal notes associated with this request, if any.
     */
    notes: z.string().optional(),

    /**
     * Unique IDs of the teams, and whether one or more associated shifts have been scheduled.
     */
    shifts: z.record(z.string(), z.array(z.number())),
});

/**
 * The context required by the program request.
 */
const kProgramRequestContext = z.object({
    context: z.object({
        /**
         * Slug of the event for which program requests are being managed.
         */
        event: z.string(),
    }),
});

/**
 * Context required by the program request mechanism.
 */
export type ProgramRequestContext = z.infer<typeof kProgramRequestContext>['context'];

/**
 * Export type definitions so that the Program Request DataTable API can be used in `callApi()`.
 */
export type ProgramRequestEndpoints =
    DataTableEndpoints<typeof kProgramRequestRowModel, typeof kProgramRequestContext>;

/**
 * Export type definition for the Program Request DataTable API's Row Model.
 */
export type ProgramRequestRowModel = z.infer<typeof kProgramRequestRowModel>;

/**
 * The table will first be sorted by status, and this record decides the actual order.
 */
const kProgramRequestSortOrder = {
    // Not started:
    'Unknown': 0,

    // In progress:
    'Contacted': 1,

    // Finished:
    'Scheduled': 2,
};

/**
 * The program request API is implemented as a regular, editable DataTable API.
 */
export const { GET, PUT } = createDataTableApi(kProgramRequestRowModel, kProgramRequestContext, {
    async accessCheck({ context }, action, props) {
        switch (action) {
            case 'create':
            case 'delete':
            case 'get':
                forbidden();

            case 'list':
                await requireAuthentication(props.authenticationContext);
                break;

            case 'update':
                await requireAuthentication(props.authenticationContext, {
                    permission: 'event.requests',
                    scope: {
                        event: context.event,
                    },
                });

                break;
        }
    },

    async list({ context, pagination }) {
        const event = await getEventBySlug(context.event);
        if (!event || !event.festivalId)
            notFound();

        const teams = await db.selectFrom(tEventsTeams)
            .selectOneColumn(tEventsTeams.teamId)
            .where(tEventsTeams.eventId.equals(event.eventId))
                .and(tEventsTeams.enableTeam.equals(/* true= */ 1))
            .executeSelectMany();

        const shiftsJoin = tShifts.forUseInLeftJoin();
        const usersJoin = tUsers.forUseInLeftJoin();

        const dbInstance = db;
        const rawRequests = await dbInstance.selectFrom(tActivities)
            .leftJoin(usersJoin)
                .on(usersJoin.userId.equals(tActivities.activityRequestAssignee))
            .leftJoin(shiftsJoin)
                .on(shiftsJoin.shiftActivityId.equals(tActivities.activityId))
                    .and(shiftsJoin.eventId.equals(event.eventId))
                    .and(shiftsJoin.teamId.in(teams))
                    .and(shiftsJoin.shiftDeleted.isNull())
            .where(tActivities.activityFestivalId.equals(event.festivalId))
                .and(tActivities.activityHelpNeeded.equals(/* true= */ 1))
                .and(tActivities.activityDeleted.isNull())
            .select({
                id: tActivities.activityId,
                activity: tActivities.activityTitle,
                assignee: usersJoin.name,
                notes: tActivities.activityRequestNotes,

                shifts: dbInstance.aggregateAsArray({
                    teamId: shiftsJoin.teamId,
                    shiftId: shiftsJoin.shiftId,
                }),
            })
            .groupBy(tActivities.activityId)
            .executeSelectMany();

        const requests = rawRequests.map(request => {
            const shifts: ProgramRequestRowModel['shifts'] = {};
            for (const shift of request.shifts) {
                if (!Object.hasOwn(shifts, shift.teamId))
                    shifts[shift.teamId] = [ shift.shiftId ];
                else
                    shifts[shift.teamId].push(shift.shiftId);
            }

            let status: ProgramRequestRowModel['status'];
            if (!!request.shifts.length)
                status = 'Scheduled';
            else if (!!request.assignee)
                status = 'Contacted';
            else
                status = 'Unknown';

            return { ...request, shifts, status };
        });

        requests.sort((lhs, rhs) => {
            const lhsSortOrder = kProgramRequestSortOrder[lhs.status];
            const rhsSortOrder = kProgramRequestSortOrder[rhs.status];

            if (lhsSortOrder !== rhsSortOrder)
                return lhsSortOrder - rhsSortOrder;

            return lhs.activity.localeCompare(rhs.activity);
        });

        const page = pagination?.page ?? 0;
        const pageSize = pagination?.pageSize ?? 10;

        return {
            success: true,
            rowCount: requests.length,
            rows: requests.slice(page * pageSize, (page + 1) * pageSize),
        };
    },

    async update({ context, row }) {
        const event = await getEventBySlug(context.event);
        if (!event || !event.festivalId)
            notFound();

        let requestAssignee: number | null = null;
        if (!!row.assignee) {
            requestAssignee = await db.selectFrom(tUsers)
                .selectOneColumn(tUsers.userId)
                .where(tUsers.name.equals(row.assignee))
                .executeSelectNoneOrOne();
        }

        const affectedRows = await db.update(tActivities)
            .set({
                activityRequestAssignee: requestAssignee,
                activityRequestNotes: row.notes,
            })
            .where(tActivities.activityId.equals(row.id))
                .and(tActivities.activityFestivalId.equals(event.festivalId))
            .executeUpdate();

        return { success: !!affectedRows };
    },

    async writeLog({ id, context }, mutation, props) {
        const event = await getEventBySlug(context.event);
        if (!event || !event.festivalId || mutation !== 'Updated')
            return;

        const activityTitle = await db.selectFrom(tActivities)
            .selectOneColumn(tActivities.activityTitle)
            .where(tActivities.activityId.equals(id))
                .and(tActivities.activityFestivalId.equals(event.festivalId))
                .and(tActivities.activityDeleted.isNull())
            .executeSelectNoneOrOne();

        RecordLog({
            type: kLogType.AdminEventProgramRequestUpdate,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            data: {
                activity: activityTitle,
                event: event.shortName,
            }
        });
    },
});
