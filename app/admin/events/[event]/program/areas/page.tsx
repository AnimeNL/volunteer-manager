// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import MapIcon from '@mui/icons-material/Map';

import type { Column, ExtractRowModel } from '@app/admin/components/DataTable';
import { HistorySection } from '../HistorySection';
import { AnPlanLinkCell, AnPlanLinkHeader, DisplayNameCell } from '../ProgramCells';
import { DataTable, createDataSource, kEventTransformer, withContext, withRowModel }
    from '@app/admin/components/DataTable';
import { LogBuilder } from '@lib/log/index';
import { ScheduleCache } from '@app/api/event/schedule/ScheduleCache';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { getAnPlanAreaUrl } from '@lib/AnPlan';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';
import db, { tActivitiesAreas, tActivitiesLogs } from '@lib/database';

import { kActivityType, kMutation, kMutationSeverity } from '@lib/database/Types';

/**
 * Offset to use for internal Area IDs, to avoid overlap with AnPlan data.
 */
const kInternalAreaIdOffset = 1_000_000;

/**
 * Data source for areas configured for an event.
 */
const programAreasDataSource = createDataSource('admin/event/program/areas', withContext({
    /**
     * Event for which the areas are being obtained.
     */
    event: kEventTransformer,

}), withRowModel({
    /**
     * Unique ID of the area.
     */
    id: z.number(),

    /**
     * Original name of the area.
     */
    name: z.string().nonempty(),

    /**
     * Display name for the area, if customized.
     */
    displayName: z.string().nullish(),

    /**
     * Link to this area in AnPlan, when sourced externally.
     */
    anplanLink: z.string().optional(),

    /**
     * Whether the row is protected from deletion (AnPlan areas).
     */
    isProtected: z.boolean(),

}), {
    async authorize(operation, props, context) {
        executeAccessCheck(props.authenticationContext, {
            permission: 'event.visible',
            scope: {
                event: context.event.slug,
            },
        });
    },

    async create(partialRow, props, context) {
        const festivalId = context.event.integrations?.anPlanFestivalId;
        if (!festivalId)
            notFound();

        if (!partialRow.displayName)
            return false;

        const dbInstance = db;
        const highestInternalAreaId = await dbInstance.selectFrom(tActivitiesAreas)
            .where(tActivitiesAreas.areaId.greaterThan(kInternalAreaIdOffset))
            .selectOneColumn(tActivitiesAreas.areaId)
            .orderBy(tActivitiesAreas.areaId, 'desc').limit(1)
            .executeSelectNoneOrOne();

        const newInternalAreaId = (highestInternalAreaId ?? kInternalAreaIdOffset) + 1;

        const insertedRows = await dbInstance.insertInto(tActivitiesAreas)
            .set({
                areaId: newInternalAreaId,
                areaFestivalId: festivalId,
                areaType: kActivityType.Internal,
                areaName: partialRow.displayName,
                areaDisplayName: partialRow.displayName,
                areaCreated: dbInstance.currentZonedDateTime(),
                areaUpdated: dbInstance.currentZonedDateTime(),
            })
            .executeInsert();

        if (!insertedRows)
            return false;

        ScheduleCache.clear('program', festivalId);

        await dbInstance.insertInto(tActivitiesLogs)
            .set({
                festivalId,
                areaId: newInternalAreaId,
                mutation: kMutation.Created,
                mutationSeverity: kMutationSeverity.Important,
                mutationUserId: props.user?.id,
                mutationDate: dbInstance.currentZonedDateTime(),
            })
            .executeInsert();

        LogBuilder.for('CreateProgramEntity')
            .withCondition(!!insertedRows)
            .withInitiatorUser(props.user)
            .record({
                event: context.event.shortName,
                entity: partialRow.displayName,
                entityType: 'area',
            });

        return true;
    },

    async delete(row, props, context) {
        const festivalId = context.event.integrations?.anPlanFestivalId;
        if (!festivalId)
            notFound();

        const dbInstance = db;
        const affectedRows = await dbInstance.update(tActivitiesAreas)
            .set({
                areaDeleted: dbInstance.currentZonedDateTime(),
            })
            .where(tActivitiesAreas.areaFestivalId.equals(festivalId))
                .and(tActivitiesAreas.areaId.equals(row.id))
                .and(tActivitiesAreas.areaType.equals(kActivityType.Internal))
                .and(tActivitiesAreas.areaDeleted.isNull())
            .executeUpdate();

        if (!affectedRows)
            return false;

        ScheduleCache.clear('program', festivalId);

        await dbInstance.insertInto(tActivitiesLogs)
            .set({
                festivalId,
                areaId: row.id,
                mutation: kMutation.Deleted,
                mutationSeverity: kMutationSeverity.Important,
                mutationUserId: props.user?.id,
                mutationDate: dbInstance.currentZonedDateTime(),
            })
            .executeInsert();

        LogBuilder.for('DeleteProgramEntity')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .record({
                event: context.event.shortName,
                entity: row.displayName || row.name,
                entityType: 'area',
            });

        return true;
    },

    async list(params, props, context) {
        const festivalId = context.event.integrations?.anPlanFestivalId;
        if (!festivalId)
            notFound();

        const areas = await db.selectFrom(tActivitiesAreas)
            .where(tActivitiesAreas.areaFestivalId.equals(festivalId))
                .and(tActivitiesAreas.areaDeleted.isNull())
                .and(tActivitiesAreas.areaName.containsInsensitiveIfValue(params.search).or(
                    tActivitiesAreas.areaDisplayName.containsInsensitiveIfValue(params.search)))
            .select({
                id: tActivitiesAreas.areaId,
                type: tActivitiesAreas.areaType,
                name: tActivitiesAreas.areaName,
                displayName: tActivitiesAreas.areaDisplayName,
            })
            .orderBy(params.sort.field as any ?? 'name', params.sort.direction)
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        return {
            rowCount: areas.count,
            rows: areas.data.map(area => ({
                id: area.id,
                type: area.type,
                name: area.name,
                displayName: area.displayName,
                anplanLink: area.id > kInternalAreaIdOffset
                    ? undefined
                    : getAnPlanAreaUrl(area.id),
                isProtected: area.type !== kActivityType.Internal,
            })),
        };
    },

    async update(row, previousRow, props, context) {
        const festivalId = context.event.integrations?.anPlanFestivalId;
        if (!festivalId)
            notFound();

        const dbInstance = db;
        const affectedRows = await dbInstance.update(tActivitiesAreas)
            .set({
                areaName: !!row.displayName ? row.displayName : 'Unknown area',
                areaDisplayName: !!row.displayName ? row.displayName : null,
                areaUpdated: dbInstance.currentZonedDateTime(),
            })
            .where(tActivitiesAreas.areaFestivalId.equals(festivalId))
                .and(tActivitiesAreas.areaId.equals(row.id))
                .and(tActivitiesAreas.areaDeleted.isNull())
            .executeUpdate();

        if (!affectedRows)
            return false;

        ScheduleCache.clear('program', festivalId);

        await dbInstance.insertInto(tActivitiesLogs)
            .set({
                festivalId,
                areaId: row.id,
                mutation: kMutation.Updated,
                mutationFields: 'display name',
                mutationSeverity: kMutationSeverity.Important,
                mutationUserId: props.user?.id,
                mutationDate: dbInstance.currentZonedDateTime(),
            })
            .executeInsert();

        LogBuilder.for('UpdateProgramEntity')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .record({
                event: context.event.shortName,
                entity: row.displayName || row.name,
                entityType: 'area',
            });

        return true;
    },
});

/**
 * The <ProgramAreasPage> component contains the areas that are part of the event's venue.
 */
export default async function ProgramAreasPage(
    props: PageProps<'/admin/events/[event]/program/areas'>)
{
    const { event } = await requireAuthenticationWithEvent(props);
    if (!event.integrations?.anPlanFestivalId)
        notFound();

    const columns: Column<ExtractRowModel<typeof programAreasDataSource>>[] = [
        {
            field: 'anplanLink',
            headerName: '',
            align: 'center',
            headerAlign: 'center',
            sortable: false,
            width: 50,

            template: 'component',
            templateProps: {
                headerComponent: AnPlanLinkHeader,
                component: AnPlanLinkCell,
            },
        },
        {
            field: 'name',
            headerName: 'Area name',
            flex: 1,
            sortable: true,
        },
        {
            field: 'displayName',
            headerName: 'Display name',
            editable: true,
            sortable: true,
            flex: 1,

            editorProps: {
                required: true,
            },

            template: 'component',
            templateProps: {
                component: DisplayNameCell,
            },
        },
    ];

    return (
        <>
            <Section icon={ <MapIcon color="primary" /> } title="Areas"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: 'Program', href: `/admin/events/${event.slug}/program` },
                         { label: 'Areas' },
                     ]}>
                <SectionIntroduction>
                    Areas configured for {event.shortName} in AnPlan.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                <DataTable columns={columns} source={programAreasDataSource}
                           context={{ event: event.slug }}
                           defaultSort={{ field: 'name', sort: 'asc' }}
                           search="prominent" disableFooter pageSize={100}
                           protectedColumn="isProtected" subject="area"
                           listViewProps={{
                               primaryField: 'displayName',
                               secondaryField: 'name',
                           }} />
            </Section>
            <HistorySection event={event.slug} scope="areas" />
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Areas', 'Program', { event: 'event' });
