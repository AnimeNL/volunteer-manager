// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod';

import { default as MuiLink } from '@mui/material/Link';

import { type Column, type DataSourceListParams, type ExtractContext, type ExtractRowModel,
    DataTable, createDataSource, withContext, withRowModel, kEventTransformer }
        from '@app/admin/components/DataTable';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import db, { tActivities, tActivitiesAreas, tActivitiesLocations, tActivitiesLogs, tUsers }
    from '@lib/database';

import { kAnyTeam } from '@lib/auth/AccessList';
import { kMutation, kMutationSeverity } from '@lib/database/Types';

/**
 * File-private global instance of a left-join for the users table, which is referred to frequently.
 */
const usersJoin = tUsers.forUseInLeftJoin();

/**
 * Composes the change description for the given `change`. Extracted so that it can be reused for
 * different data fetching functions.
 */
function formatActivityChange(change: {
    activityName: string,
    mutation: keyof typeof kMutation,
    mutationFields?: string,
    timeslotId?: number,
}): string {
    if (!!change.timeslotId)
        return `${change.mutation} a timeslot for ${change.activityName}`;

    if (!!change.mutationFields)
        return `${change.mutation} ${change.activityName} (${change.mutationFields})`;

    return `${change.mutation} the ${change.activityName} activity`;
}

/**
 * Information that must be returned when responding to a program history query.
 */
interface HistoryQueryResult {
    rowCount: number;
    rows: z.infer<typeof historyDataSourceRowModel>[];
}

/**
 * Queries the history of all activities for a particular festival from the database.
 */
async function queryActivitiesHistory(params: DataSourceListParams, festivalId: number)
    : Promise<HistoryQueryResult>
{
    const dbInstance = db;
    const history = await dbInstance.selectFrom(tActivitiesLogs)
        .innerJoin(tActivities)
            .on(tActivities.activityId.equals(tActivitiesLogs.activityId))
        .leftJoin(usersJoin)
            .on(usersJoin.userId.equals(tActivitiesLogs.mutationUserId))
        .where(tActivitiesLogs.festivalId.equals(festivalId))
            .and(tActivitiesLogs.activityId.isNotNull())
            .and(tActivities.activityTitle.containsIfValue(params.search).or(
                usersJoin.name.containsIfValue(params.search)))
        .select({
            id: tActivitiesLogs.mutationId,
            severity: tActivitiesLogs.mutationSeverity,
            date: dbInstance.dateTimeAsString(tActivitiesLogs.mutationDate),

            activityId: tActivitiesLogs.activityId,

            change: {
                activityName: tActivities.activityTitle,
                mutation: tActivitiesLogs.mutation,
                mutationFields: tActivitiesLogs.mutationFields,
                timeslotId: tActivitiesLogs.timeslotId,
            },

            user: {
                id: usersJoin.userId,
                name: usersJoin.name,
            },
        })
        .orderBy(params.sort.field, params.sort.direction)
        .limit(params.page.limit)
            .offset(params.page.offset)
        .executeSelectPage();

    return {
        rowCount: history.count,
        rows: history.data.map(row => ({
            id: row.id,
            severity: row.severity,
            date: row.date,

            change: formatActivityChange(row.change),
            references: {
                activityId: row.activityId,
            },

            user: row.user,
        })),
    };
}

/**
 * Queries the history of a particular activity for a particular festival from the database.
 */
async function queryActivityHistory(
    params: DataSourceListParams, festivalId: number, activityId: number)
        : Promise<HistoryQueryResult>
{
    const dbInstance = db;
    const history = await dbInstance.selectFrom(tActivitiesLogs)
        .innerJoin(tActivities)
            .on(tActivities.activityId.equals(tActivitiesLogs.activityId))
        .leftJoin(usersJoin)
            .on(usersJoin.userId.equals(tActivitiesLogs.mutationUserId))
        .where(tActivitiesLogs.festivalId.equals(festivalId))
            .and(tActivitiesLogs.activityId.equals(activityId))
            .and(tActivities.activityTitle.containsIfValue(params.search).or(
                tActivitiesLogs.mutationFields.containsIfValue(params.search).or(
                usersJoin.name.containsIfValue(params.search))))
        .select({
            id: tActivitiesLogs.mutationId,
            severity: tActivitiesLogs.mutationSeverity,
            date: dbInstance.dateTimeAsString(tActivitiesLogs.mutationDate),

            activityId: tActivitiesLogs.activityId,

            change: {
                activityName: tActivities.activityTitle,
                mutation: tActivitiesLogs.mutation,
                mutationFields: tActivitiesLogs.mutationFields,
                timeslotId: tActivitiesLogs.timeslotId,
            },

            user: {
                id: usersJoin.userId,
                name: usersJoin.name,
            },
        })
        .orderBy(params.sort.field, params.sort.direction)
        .limit(params.page.limit)
            .offset(params.page.offset)
        .executeSelectPage();

    return {
        rowCount: history.count,
        rows: history.data.map(row => ({
            id: row.id,
            severity: row.severity,
            date: row.date,

            change: formatActivityChange(row.change),
            references: {
                activityId: row.activityId,
            },

            user: row.user,
        })),
    };
}

/**
 * Queries the history of all areas for a particular festival from the database.
 */
async function queryAreasHistory(params: DataSourceListParams, festivalId: number)
    : Promise<HistoryQueryResult>
{
    const dbInstance = db;
    const history = await dbInstance.selectFrom(tActivitiesLogs)
        .innerJoin(tActivitiesAreas)
            .on(tActivitiesAreas.areaId.equals(tActivitiesLogs.areaId))
        .leftJoin(usersJoin)
            .on(usersJoin.userId.equals(tActivitiesLogs.mutationUserId))
        .where(tActivitiesLogs.festivalId.equals(festivalId))
            .and(tActivitiesLogs.areaId.isNotNull())
            .and(tActivitiesAreas.areaName.containsIfValue(params.search).or(
                tActivitiesAreas.areaDisplayName.containsIfValue(params.search).or(
                usersJoin.name.containsIfValue(params.search))))
        .select({
            id: tActivitiesLogs.mutationId,
            severity: tActivitiesLogs.mutationSeverity,
            date: dbInstance.dateTimeAsString(tActivitiesLogs.mutationDate),

            mutation: tActivitiesLogs.mutation,
            area: {
                id: tActivitiesAreas.areaId,
                name: tActivitiesAreas.areaDisplayName.valueWhenNull(tActivitiesAreas.areaName),
            },

            user: {
                id: usersJoin.userId,
                name: usersJoin.name,
            },
        })
        .orderBy(params.sort.field, params.sort.direction)
        .limit(params.page.limit)
            .offset(params.page.offset)
        .executeSelectPage();

    return {
        rowCount: history.count,
        rows: history.data.map(row => ({
            id: row.id,
            severity: row.severity,
            date: row.date,

            change: `${row.mutation} the "${row.area.name}" area`,
            references: {
                areaId: row.area.id,
            },

            user: row.user,
        })),
    };
}

/**
 * Queries the history of all locations for a particular festival from the database.
 */
async function queryLocationsHistory(params: DataSourceListParams, festivalId: number)
    : Promise<HistoryQueryResult>
{
    const dbInstance = db;
    const history = await dbInstance.selectFrom(tActivitiesLogs)
        .innerJoin(tActivitiesLocations)
            .on(tActivitiesLocations.locationId.equals(tActivitiesLogs.locationId))
        .leftJoin(usersJoin)
            .on(usersJoin.userId.equals(tActivitiesLogs.mutationUserId))
        .where(tActivitiesLogs.festivalId.equals(festivalId))
            .and(tActivitiesLogs.locationId.isNotNull())
            .and(tActivitiesLocations.locationName.containsIfValue(params.search).or(
                tActivitiesLocations.locationDisplayName.containsIfValue(params.search).or(
                usersJoin.name.containsIfValue(params.search))))
        .select({
            id: tActivitiesLogs.mutationId,
            severity: tActivitiesLogs.mutationSeverity,
            date: dbInstance.dateTimeAsString(tActivitiesLogs.mutationDate),

            mutation: tActivitiesLogs.mutation,
            location: {
                id: tActivitiesLocations.locationId,
                name: tActivitiesLocations.locationDisplayName.valueWhenNull(
                    tActivitiesLocations.locationName),
            },

            user: {
                id: usersJoin.userId,
                name: usersJoin.name,
            },
        })
        .orderBy(params.sort.field, params.sort.direction)
        .limit(params.page.limit)
            .offset(params.page.offset)
        .executeSelectPage();

    return {
        rowCount: history.count,
        rows: history.data.map(row => ({
            id: row.id,
            severity: row.severity,
            date: row.date,

            change: `${row.mutation} the "${row.location.name}" location`,
            references: {
                locationId: row.location.id,
            },

            user: row.user,
        })),
    };
}

/**
 * Queries the history of all help requests for a particular festival from the database.
 */
async function queryRequestsHistory(params: DataSourceListParams, festivalId: number)
    : Promise<HistoryQueryResult>
{
    const dbInstance = db;
    const history = await dbInstance.selectFrom(tActivitiesLogs)
        .innerJoin(tActivities)
            .on(tActivities.activityId.equals(tActivitiesLogs.activityId))
        .leftJoin(usersJoin)
            .on(usersJoin.userId.equals(tActivitiesLogs.mutationUserId))
        .where(tActivitiesLogs.festivalId.equals(festivalId))
            .and(tActivitiesLogs.activityId.isNotNull())
            .and(tActivitiesLogs.mutation.equals(kMutation.Updated))
            .and(tActivitiesLogs.mutationFields.contains('help needed'))
            .and(tActivities.activityTitle.containsIfValue(params.search).or(
                usersJoin.name.containsIfValue(params.search)))
        .select({
            id: tActivitiesLogs.mutationId,
            severity: tActivitiesLogs.mutationSeverity,
            date: dbInstance.dateTimeAsString(tActivitiesLogs.mutationDate),

            activity: {
                id: tActivities.activityId,
                title: tActivities.activityTitle,
            },

            user: {
                id: usersJoin.userId,
                name: usersJoin.name,
            },
        })
        .orderBy(params.sort.field, params.sort.direction)
        .limit(params.page.limit)
            .offset(params.page.offset)
        .executeSelectPage();

    return {
        rowCount: history.count,
        rows: history.data.map(row => ({
            id: row.id,
            severity: row.severity,
            date: row.date,

            change: `Changed the "Staff help requested" flag for ${row.activity.title}`,
            references: {
                activityId: row.activity.id,
            },

            user: row.user,
        })),
    };
}

/**
 * Row model that applies to the history data source.
 */
const historyDataSourceRowModel = withRowModel({
    /**
     * Unique ID of the mutation's log entry, as it exists in the database.
     */
    id: z.number(),

    /**
     * Severity of the mutation, indicating its relevance to our operations.
     */
    severity: z.enum(kMutationSeverity),

    /**
     * Date of the mutation, in a Temporal ZDT-compatible serialisation.
     */
    date: z.string(),

    /**
     * Details about the change that was made through this mutation.
     */
    change: z.string(),

    /**
     * Optional references in case the change description should link to something.
     */
    references: z.object({
        activityId: z.number().optional(),
        areaId: z.number().optional(),
        locationId: z.number().optional(),
    }),

    /**
     * When this is a Volunteer Manager mutation, the unique user ID and name of the author.
     */
    user: z.object({
        id: z.number(),
        name: z.string(),
    }).optional(),
});

/**
 * Data source for the program history table, which is sourced from mutation logs generated for the
 * various `activities_*` tables. These combine mutations to AnPlan with our own.
 */
const historyDataSource = createDataSource('admin/events/program/history', withContext({
    event: kEventTransformer,
    scope: z.discriminatedUnion('category', [
        z.object({ category: z.literal('activities') }),
        z.object({ category: z.literal('activity'), activityId: z.number() }),
        z.object({ category: z.literal('areas') }),
        z.object({ category: z.literal('locations')}),
        z.object({ category: z.literal('requests') }),
    ]),
}), historyDataSourceRowModel, {
    async authorize(operation, props, context) {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin-event',
            event: context.event.slug,
            team: kAnyTeam,
        });
    },

    async list(params, props, context) {
        if (!context.event.festivalId)
            notFound();

        switch (context.scope.category) {
            case 'activities':
                return await queryActivitiesHistory(params, context.event.festivalId);
            case 'activity':
                return await queryActivityHistory(
                    params, context.event.festivalId, context.scope.activityId);
            case 'areas':
                return await queryAreasHistory(params, context.event.festivalId);
            case 'locations':
                return await queryLocationsHistory(params, context.event.festivalId);
            case 'requests':
                return await queryRequestsHistory(params, context.event.festivalId);
        }
    }
});

/**
 * Context that's expected to be made available for the history data source.
 */
type HistoryDataSourceContext = ExtractContext<typeof historyDataSource>;

/**
 * The <ProgramHistory> component displays an overview of the most recent changes that were made to
 * the program, both in the imported AnPlan data and changes made within our own modifications.
 */
export function ProgramHistory(context: HistoryDataSourceContext) {
    const columns: Column<ExtractRowModel<typeof historyDataSource>>[] = [
        {
            field: 'severity',
            template: 'severity',
        },
        {
            field: 'date',
            template: 'localDate',
        },
        {
            field: 'change',
            flex: 3,

            headerName: 'Change',
            sortable: false,
        },
        {
            field: 'user',
            template: 'account',
            templateProps: {
                noAccountLabel: 'AnPlan',
            },

            flex: 1,

            headerName: 'Account',
            sortable: false,
        },
    ];

    const category =
        context.scope.category === 'activity'
            ? 'this activity'
            : context.scope.category;

    return (
        <Section title="Recent changes" subtitle={category}>
            <SectionIntroduction>
                This table summarises changes made to <strong>{category}</strong> across the
                Volunteer Manager and <MuiLink href="https://anplan.animecon.nl/">AnPlan</MuiLink>,
                the official AnimeCon planning tool.
            </SectionIntroduction>
            <DataTable columns={columns} source={historyDataSource} context={context}
                       defaultSort={{ field: 'date', sort: 'desc' }} pageSize={10}
                       enableSearch="subtle" />
        </Section>
    );
}
