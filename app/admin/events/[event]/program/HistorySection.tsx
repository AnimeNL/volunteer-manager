// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import HistoryIcon from '@mui/icons-material/History';

import type { Column, ExtractRowModel } from '@app/admin/components/DataTable';
import { DataTable, createDataSource, withContext, withRowModel }
    from '@app/admin/components/DataTable';
import { Section } from '@app/admin/components/Section';
import { SeverityCell } from '@app/admin/components/DataTable/cells/SeverityCell';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import db, { tActivities, tActivitiesAreas, tActivitiesLocations, tActivitiesLogs,
    tUsers } from '@lib/database';

import { kEventTransformer } from '@app/admin/components/DataTable';

/**
 * Data source for recent changes to the event's program.
 */
const programHistoryDataSource = createDataSource('admin/event/program/history', withContext({
    /**
     * Event for which history is being retrieved.
     */
    event: kEventTransformer,

    /**
     * Scope of the history entries to show.
     */
    scope: z.enum([ 'activities', 'areas', 'locations', 'requests' ]).optional(),

    /**
     * Optional activity ID when history should be filtered to an individual activity.
     */
    activityId: z.number().optional(),

}), withRowModel({
    /**
     * Unique ID of the mutation log entry.
     */
    id: z.number(),

    /**
     * Date and time at which the mutation occurred.
     */
    date: z.string(),

    /**
     * Severity of the mutation.
     */
    severity: z.string(),

    /**
     * Name or title of the mutated entity.
     */
    entity: z.string(),

    /**
     * Link to the entity in the administration area.
     */
    href: z.string().optional(),

    /**
     * Description of the mutation that occurred.
     */
    mutation: z.string(),

    /**
     * User who made the mutation, if initiated by a human user.
     */
    user: z.object({
        id: z.number(),
        name: z.string(),
    }).optional(),

    /**
     * Summary of the change for mobile display.
     */
    summary: z.string(),

}), {
    async authorize(operation, props, context) {
        executeAccessCheck(props.authenticationContext, {
            permission: 'event.visible',
            scope: {
                event: context.event.slug,
            },
        });
    },

    async list(params, props, context) {
        const festivalId = context.event.integrations?.anPlanFestivalId;
        if (!festivalId)
            return notFound();

        const activitiesJoin = tActivities.forUseInLeftJoin();
        const areasJoin = tActivitiesAreas.forUseInLeftJoin();
        const locationsJoin = tActivitiesLocations.forUseInLeftJoin();
        const usersJoin = tUsers.forUseInLeftJoin();

        const dbInstance = db;
        const logs = await dbInstance.selectFrom(tActivitiesLogs)
            .leftJoin(activitiesJoin)
                .on(activitiesJoin.activityFestivalId.equals(festivalId)
                    .and(activitiesJoin.activityId.equals(tActivitiesLogs.activityId)))
            .leftJoin(areasJoin)
                .on(areasJoin.areaFestivalId.equals(festivalId)
                    .and(areasJoin.areaId.equals(tActivitiesLogs.areaId)))
            .leftJoin(locationsJoin)
                .on(locationsJoin.locationFestivalId.equals(festivalId)
                    .and(locationsJoin.locationId.equals(tActivitiesLogs.locationId)))
            .leftJoin(usersJoin)
                .on(usersJoin.userId.equals(tActivitiesLogs.mutationUserId))
            .where(tActivitiesLogs.festivalId.equals(festivalId))
                .and(tActivitiesLogs.activityId.equalsIfValue(context.activityId))
                .and(tActivitiesLogs.activityId.isNotNull().onlyWhen(
                    !context.activityId && context.scope === 'activities'))
                .and(tActivitiesLogs.areaId.isNotNull().onlyWhen(
                    !context.activityId && context.scope === 'areas'))
                .and(tActivitiesLogs.locationId.isNotNull().onlyWhen(
                    !context.activityId && context.scope === 'locations'))
                .and(tActivitiesLogs.activityId.isNotNull().and(
                    activitiesJoin.activityHelpNeeded.equals(1).or(
                        tActivitiesLogs.mutationFields.containsInsensitive('help'))).onlyWhen(
                            !context.activityId && context.scope === 'requests'))
            .select({
                id: tActivitiesLogs.mutationId,
                activityId: tActivitiesLogs.activityId,
                activityTitle: activitiesJoin.activityTitle,
                areaId: tActivitiesLogs.areaId,
                areaName: areasJoin.areaDisplayName.valueWhenNull(areasJoin.areaName),
                locationId: tActivitiesLogs.locationId,
                locationName: locationsJoin.locationDisplayName.valueWhenNull(
                    locationsJoin.locationName),
                mutation: tActivitiesLogs.mutation,
                mutationFields: tActivitiesLogs.mutationFields,
                mutationSeverity: tActivitiesLogs.mutationSeverity,
                mutationUserId: usersJoin.userId,
                mutationUserName: usersJoin.name,
                mutationDate: dbInstance.dateTimeAsString(tActivitiesLogs.mutationDate),
            })
            .orderBy(tActivitiesLogs.mutationDate, 'desc')
                .orderBy(tActivitiesLogs.mutationId, 'desc')
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        return {
            rowCount: logs.count,
            rows: logs.data.map(log => {
                let entity: string = 'Unknown';
                let href: string | undefined;

                if (log.activityId !== null && log.activityId !== undefined) {
                    entity = log.activityTitle ?? `Activity #${log.activityId}`;
                    href = `/admin/events/${context.event.slug}/program/activities/${log.activityId}`;
                } else if (log.areaId !== null && log.areaId !== undefined) {
                    entity = log.areaName ?? `Area #${log.areaId}`;
                    href = `/admin/events/${context.event.slug}/program/areas`;
                } else if (log.locationId !== null && log.locationId !== undefined) {
                    entity = log.locationName ?? `Location #${log.locationId}`;
                    href = `/admin/events/${context.event.slug}/program/locations`;
                }

                let mutation = String(log.mutation);
                if (log.mutation === 'Updated' && !!log.mutationFields)
                    mutation = `Updated (${log.mutationFields})`;

                const user = (log.mutationUserId && log.mutationUserName) ? {
                    id: log.mutationUserId,
                    name: log.mutationUserName,
                } : undefined;

                const summary = `${mutation} by ${user?.name ?? 'AnPlan'}`;

                return {
                    id: log.id,
                    date: log.mutationDate,
                    severity: log.mutationSeverity,
                    entity,
                    href,
                    mutation,
                    user,
                    summary,
                };
            }),
        };
    },
});

/**
 * Props accepted by the <HistorySection> component.
 */
interface HistorySectionProps {
    /**
     * Unique slug of the event for which history should be displayed.
     */
    event: string;

    /**
     * Optional ID of the activity to restrict history entries to.
     */
    activityId?: number;

    /**
     * Scope of history entries to display. Defaults to all program content.
     */
    scope?: 'activities' | 'areas' | 'locations' | 'requests';
}

/**
 * The <HistorySection> component displays recent changes to the program in a table.
 */
export async function HistorySection(props: HistorySectionProps) {
    const columns: Column<ExtractRowModel<typeof programHistoryDataSource>>[] = [
        {
            field: 'severity',
            headerName: '',
            align: 'center',
            width: 50,
            sortable: false,

            template: 'severity',
        },
        {
            field: 'date',
            headerName: 'Date',
            sortable: false,
            width: 185,

            template: 'date',
            templateProps: {
                format: 'YYYY-MM-DD HH:mm:ss',
            },
        },
        ...(
            !props.activityId ? [
                {
                    field: 'entity' as const,
                    headerName: props.scope === 'activities' ? 'Activity'
                        : props.scope === 'areas' ? 'Area'
                        : props.scope === 'locations' ? 'Location'
                        : props.scope === 'requests' ? 'Request'
                        : 'Item',
                    sortable: false,
                    flex: 2,

                    template: 'text' as const,
                    templateProps: {
                        href: '{href}',
                    },
                }
            ] : []
        ),
        {
            field: 'mutation',
            headerName: 'Change',
            sortable: false,
            flex: 2,
        },
        {
            field: 'user',
            headerName: 'Modified by',
            sortable: false,
            flex: 1,

            template: 'account',
            templateProps: {
                noAccountLabel: 'AnPlan',
            },
        },
    ];

    const listViewProps = props.activityId ? {
        primaryField: 'mutation' as const,
        secondaryField: 'summary' as const,
        dateField: 'date' as const,
        dateFieldFormat: 'YYYY-MM-DD HH:mm',
        startComponent: SeverityCell,
    } : {
        primaryField: 'entity' as const,
        secondaryField: 'summary' as const,
        dateField: 'date' as const,
        dateFieldFormat: 'YYYY-MM-DD HH:mm',
        linkTemplate: '{href}',
        startComponent: SeverityCell,
    };

    return (
        <Section icon={ <HistoryIcon /> } title="Recent changes">
            <DataTable columns={columns} source={programHistoryDataSource}
                       context={{
                           event: props.event,
                           scope: props.scope,
                           activityId: props.activityId,
                       }}
                       defaultSort={{ field: 'date', sort: 'desc' }}
                       disableQueryParams={true} disableSearch
                       pageSize={10}
                       subject="change"
                       listViewProps={listViewProps} />
        </Section>
    );
}
