// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import NewReleasesIcon from '@mui/icons-material/NewReleases';

import type { Column, ExtractRowModel } from '@app/admin/components/DataTable';
import { RequestStatusCell, RequestTeamShiftCell, RequestTeamShiftHeader } from '../ProgramCells';
import { DataTable, createDataSource, kEventTransformer, withContext, withRowModel }
    from '@app/admin/components/DataTable';
import { LogBuilder } from '@lib/log/index';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { getLeadersForEvent } from '@app/admin/lib/getLeadersForEvent';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';
import db, { tActivities, tEventsTeams, tShifts, tTeams, tUsers } from '@lib/database';

/**
 * Sort order mapping for program request statuses.
 */
const kProgramRequestSortOrder = {
    'Unknown': 0,
    'Contacted': 1,
    'Scheduled': 2,
};

/**
 * Data source for program requests.
 */
const programRequestsDataSource = createDataSource('admin/event/program/requests', withContext({
    /**
     * Event for which program requests are being managed.
     */
    event: kEventTransformer,

}), withRowModel({
    /**
     * Unique ID of the activity for which help has been requested.
     */
    id: z.number(),

    /**
     * Title of the activity.
     */
    activity: z.string(),

    /**
     * Status of the program request.
     */
    status: z.enum([ 'Unknown', 'Contacted', 'Scheduled' ]),

    /**
     * Name of the assignee, if any.
     */
    assignee: z.string().optional(),

    /**
     * User ID of the assignee, if any.
     */
    assigneeUserId: z.number().or(z.literal('')).nullish(),

    /**
     * Internal notes regarding this request.
     */
    notes: z.string().optional(),

    /**
     * Scheduled shifts grouped by team ID.
     */
    shifts: z.record(z.string(), z.array(z.number())),

}), {
    async authorize(operation, props, context) {
        if (operation === 'update') {
            executeAccessCheck(props.authenticationContext, {
                permission: 'event.requests',
                scope: {
                    event: context.event.slug,
                },
            });
        } else {
            executeAccessCheck(props.authenticationContext, {
                permission: 'event.visible',
                scope: {
                    event: context.event.slug,
                },
            });
        }
    },

    async list(params, props, context) {
        const festivalId = context.event.integrations?.anPlanFestivalId;
        if (!festivalId)
            notFound();

        const shiftsJoin = tShifts.forUseInLeftJoin();
        const usersJoin = tUsers.forUseInLeftJoin();

        const dbInstance = db;
        const rawRequests = await dbInstance.selectFrom(tActivities)
            .leftJoin(usersJoin)
                .on(usersJoin.userId.equals(tActivities.activityRequestAssignee))
            .leftJoin(shiftsJoin)
                .on(shiftsJoin.shiftActivityId.equals(tActivities.activityId))
                    .and(shiftsJoin.eventId.equals(context.event.id))
                    .and(shiftsJoin.shiftDeleted.isNull())
            .where(tActivities.activityFestivalId.equals(festivalId))
                .and(tActivities.activityHelpNeeded.equals(/* true= */ 1))
                .and(tActivities.activityDeleted.isNull())
                .and(tActivities.activityTitle.containsInsensitiveIfValue(params.search).or(
                    tActivities.activityRequestNotes.containsInsensitiveIfValue(params.search).or(
                    usersJoin.name.containsInsensitiveIfValue(params.search))))
            .select({
                id: tActivities.activityId,
                activity: tActivities.activityTitle,
                assignee: usersJoin.name,
                assigneeUserId: usersJoin.userId,
                notes: tActivities.activityRequestNotes,

                shifts: dbInstance.aggregateAsArray({
                    teamId: shiftsJoin.teamId,
                    shiftId: shiftsJoin.shiftId,
                }),
            })
            .groupBy(tActivities.activityId)
            .executeSelectMany();

        const requests = rawRequests.map(request => {
            const shifts: Record<string, number[]> = {};
            for (const shift of request.shifts) {
                if (!Object.hasOwn(shifts, shift.teamId))
                    shifts[shift.teamId] = [ shift.shiftId ];
                else
                    shifts[shift.teamId].push(shift.shiftId);
            }

            let status: 'Contacted' | 'Scheduled' | 'Unknown';
            if (request.shifts.length > 0)
                status = 'Scheduled';
            else if (request.assignee)
                status = 'Contacted';
            else
                status = 'Unknown';

            return {
                id: request.id,
                activity: request.activity,
                status,
                assignee: request.assignee ?? undefined,
                assigneeUserId: request.assigneeUserId ?? null,
                notes: request.notes ?? undefined,
                shifts,
            };
        });

        requests.sort((lhs, rhs) => {
            const lhsSortOrder = kProgramRequestSortOrder[lhs.status];
            const rhsSortOrder = kProgramRequestSortOrder[rhs.status];

            if (lhsSortOrder !== rhsSortOrder)
                return lhsSortOrder - rhsSortOrder;

            return lhs.activity.localeCompare(rhs.activity);
        });

        return {
            rowCount: requests.length,
            rows: requests.slice(params.page.offset, params.page.offset + params.page.limit),
        };
    },

    async update(row, previousRow, props, context) {
        const festivalId = context.event.integrations?.anPlanFestivalId;
        if (!festivalId)
            notFound();

        let activityRequestAssignee: number | undefined = undefined;
        if (typeof row.assigneeUserId === 'number')
            activityRequestAssignee = row.assigneeUserId;
        else if (!!row.notes && !previousRow.assigneeUserId)
            activityRequestAssignee = props.user.id;  // auto-assign

        const dbInstance = db;
        const affectedRows = await dbInstance.update(tActivities)
            .set({
                activityRequestAssignee,
                activityRequestNotes: row.notes || null,
            })
            .where(tActivities.activityId.equals(row.id))
                .and(tActivities.activityFestivalId.equals(festivalId))
            .executeUpdate();

        LogBuilder.for('UpdateProgramRequest')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .record({
                event: context.event.shortName,
                activity: row.activity,
            });

        const assigneeName = await dbInstance.selectFrom(tUsers)
            .where(tUsers.userId.equals(activityRequestAssignee || -1))
            .selectOneColumn(tUsers.name)
            .executeSelectNoneOrOne() ?? undefined;

        return {
            ...row,
            assignee: assigneeName,
        };
    },
});

/**
 * The <ProgramRequestsPage> component lists the program entries where the organiser has requested
 * help from the volunteering teams.
 */
export default async function ProgramRequestsPage(
    props: PageProps<'/admin/events/[event]/program/requests'>)
{
    const { access, event } = await requireAuthenticationWithEvent(props);
    if (!event.integrations?.anPlanFestivalId)
        notFound();

    const comprehensiveLeaders = await getLeadersForEvent(event.id);
    const leaders = comprehensiveLeaders.map(leader => ({
        value: leader.value,
        label: leader.label,
    }));

    const canManageRequests = access.can('event.requests', { event: event.slug });

    const teams = await db.selectFrom(tEventsTeams)
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tEventsTeams.teamId))
                .and(tTeams.teamFlagProgramRequests.equals(/* true= */ 1))
        .where(tEventsTeams.eventId.equals(event.id))
            .and(tEventsTeams.enableTeam.equals(/* true= */ 1))
        .select({
            id: tTeams.teamId,
            colour: tTeams.teamColourLightTheme,
            name: tTeams.teamTitle,
            slug: tTeams.teamSlug,
        })
        .orderBy(tTeams.teamName, 'asc')
        .executeSelectMany();

    const columns: Column<ExtractRowModel<typeof programRequestsDataSource>>[] = [
        {
            field: 'activity',
            headerName: 'Activity',
            flex: 3,
            sortable: false,

            template: 'text',
            templateProps: {
                href: './activities/{id}',
            },
        },
        {
            field: 'status',
            headerName: 'Status',
            sortable: false,
            width: 110,

            template: 'component',
            templateProps: {
                component: RequestStatusCell,
            },
        },
        {
            field: 'assigneeUserId',
            headerName: 'Assignee',
            editable: canManageRequests,
            sortable: false,
            flex: 2,

            type: 'singleSelect',
            valueOptions: [
                { value: '', label: 'Unassigned' },
                ...leaders
            ],

            template: 'text',
            templateProps: {
                field: 'assignee',
            },
        },
        {
            field: 'notes',
            headerName: 'Notes',
            editable: canManageRequests,
            sortable: false,
            flex: 3,

            template: 'text',
        },
    ];

    for (const team of teams) {
        columns.push({
            field: `shifts.${team.id}` as any,
            headerName: team.name,
            align: 'center',
            headerAlign: 'center',
            sortable: false,
            width: 50,

            template: 'component',
            templateProps: {
                headerComponent: RequestTeamShiftHeader,
                component: RequestTeamShiftCell,
                componentContext: {
                    colour: team.colour,
                    name: team.name,
                    event: event.slug,
                    teamId: team.id,
                    teamSlug: team.slug,
                },
            },
        });
    }

    return (
        <>
            <Section icon={ <NewReleasesIcon color="primary" /> } title="Help requests"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: 'Program', href: `/admin/events/${event.slug}/program` },
                         { label: 'Requests' },
                     ]}>
                <SectionIntroduction>
                    Program entries where help was requested from our volunteering teams.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                <DataTable columns={columns} source={programRequestsDataSource}
                           context={{ event: event.slug }}
                           defaultSort={{ field: 'activity', sort: 'asc' }}
                           search="prominent" pageSize={50}
                           subject="request"
                           listViewProps={{
                               primaryField: 'activity',
                               secondaryField: 'status',
                           }} />
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Requests', 'Program', { event: 'event' });
