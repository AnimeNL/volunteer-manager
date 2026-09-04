// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import LocationOnIcon from '@mui/icons-material/LocationOn';

import type { Column, ExtractRowModel } from '@app/admin/components/DataTable';
import { AnPlanLinkCell, AnPlanLinkHeader, DisplayNameCell, LocationAreaCell } from '../ProgramCells';
import { DataTable, createDataSource, kEventTransformer, withContext, withRowModel }
    from '@app/admin/components/DataTable';
import { LogBuilder } from '@lib/log/index';
import { ScheduleCache } from '@app/api/event/schedule/ScheduleCache';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { getAnPlanLocationUrl } from '@lib/AnPlan';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';
import db, { tActivitiesAreas, tActivitiesLocations, tActivitiesLogs } from '@lib/database';

import { kActivityType, kMutation, kMutationSeverity } from '@lib/database/Types';

/**
 * Offset to use for internal Location IDs, to avoid overlap with AnPlan data.
 */
const kInternalLocationIdOffset = 1_000_000;

/**
 * Data source for locations configured for an event.
 */
const programLocationsDataSource = createDataSource('admin/event/program/locations', withContext({
    /**
     * Event for which locations are being displayed.
     */
    event: kEventTransformer,

}), withRowModel({
    /**
     * Unique ID of the location.
     */
    id: z.number(),

    /**
     * Original name of the location.
     */
    name: z.string().nonempty(),

    /**
     * Display name for the location, if customized.
     */
    displayName: z.string().nullish(),

    /**
     * Unique ID of the area this location belongs to.
     */
    areaId: z.number(),

    /**
     * Name of the area this location belongs to.
     */
    area: z.string(),

    /**
     * Link to this location in AnPlan, when sourced externally.
     */
    anplanLink: z.string().optional(),

    /**
     * Whether the row is protected from deletion (AnPlan locations).
     */
    isProtected: z.boolean(),

}), {
    async authorize(operation, props, context) {
        executeAccessCheck(props.authenticationContext, {
            permission: 'admin',
        });
    },

    async create(partialRow, props, context) {
        const festivalId = context.event.integrations?.anPlanFestivalId;
        if (!festivalId)
            notFound();

        if (!partialRow.displayName || !partialRow.areaId)
            return false;

        const dbInstance = db;
        const highestInternalLocationId = await dbInstance.selectFrom(tActivitiesLocations)
            .where(tActivitiesLocations.locationId.greaterThan(kInternalLocationIdOffset))
            .selectOneColumn(tActivitiesLocations.locationId)
            .orderBy(tActivitiesLocations.locationId, 'desc').limit(1)
            .executeSelectNoneOrOne();

        const newInternalLocationId = (highestInternalLocationId ?? kInternalLocationIdOffset) + 1;

        const insertedRows = await dbInstance.insertInto(tActivitiesLocations)
            .set({
                locationId: newInternalLocationId,
                locationFestivalId: festivalId,
                locationType: kActivityType.Internal,
                locationName: partialRow.displayName,
                locationDisplayName: partialRow.displayName,
                locationAreaId: partialRow.areaId,
                locationCreated: dbInstance.currentZonedDateTime(),
                locationUpdated: dbInstance.currentZonedDateTime(),
            })
            .executeInsert();

        if (!insertedRows)
            return false;

        ScheduleCache.clear('program', festivalId);

        await dbInstance.insertInto(tActivitiesLogs)
            .set({
                festivalId,
                locationId: newInternalLocationId,
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
                entityType: 'location',
            });

        return true;
    },

    async delete(row, props, context) {
        const festivalId = context.event.integrations?.anPlanFestivalId;
        if (!festivalId)
            notFound();

        const dbInstance = db;
        const affectedRows = await dbInstance.update(tActivitiesLocations)
            .set({
                locationDeleted: dbInstance.currentZonedDateTime(),
            })
            .where(tActivitiesLocations.locationFestivalId.equals(festivalId))
                .and(tActivitiesLocations.locationId.equals(row.id))
                .and(tActivitiesLocations.locationType.equals(kActivityType.Internal))
                .and(tActivitiesLocations.locationDeleted.isNull())
            .executeUpdate();

        if (!affectedRows)
            return false;

        ScheduleCache.clear('program', festivalId);

        await dbInstance.insertInto(tActivitiesLogs)
            .set({
                festivalId,
                locationId: row.id,
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
                entityType: 'location',
            });

        return true;
    },

    async list(params, props, context) {
        const festivalId = context.event.integrations?.anPlanFestivalId;
        if (!festivalId)
            notFound();

        const areasJoin = tActivitiesAreas.forUseInLeftJoin();

        const dbInstance = db;
        const locations = await dbInstance.selectFrom(tActivitiesLocations)
            .leftJoin(areasJoin)
                .on(areasJoin.areaId.equals(tActivitiesLocations.locationAreaId))
            .where(tActivitiesLocations.locationFestivalId.equals(festivalId))
                .and(tActivitiesLocations.locationDeleted.isNull())
                .and(tActivitiesLocations.locationName.containsInsensitiveIfValue(params.search).or(
                    tActivitiesLocations.locationDisplayName.containsInsensitiveIfValue(
                        params.search).or(
                    areasJoin.areaDisplayName.containsInsensitiveIfValue(params.search).or(
                    areasJoin.areaName.containsInsensitiveIfValue(params.search)))))
            .select({
                id: tActivitiesLocations.locationId,
                type: tActivitiesLocations.locationType,
                name: tActivitiesLocations.locationName,
                displayName: tActivitiesLocations.locationDisplayName,
                areaId: tActivitiesLocations.locationAreaId,
                area: areasJoin.areaDisplayName.valueWhenNull(areasJoin.areaName),
            })
            .orderBy(params.sort.field as any ?? 'name', params.sort.direction)
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        return {
            rowCount: locations.count,
            rows: locations.data.map(location => ({
                id: location.id,
                name: location.name,
                displayName: location.displayName,
                areaId: location.areaId,
                area: location.area ?? 'Unknown area',
                anplanLink: location.id > kInternalLocationIdOffset
                    ? undefined
                    : getAnPlanLocationUrl(location.id),

                // TODO: isFrozen
                isProtected: location.type !== kActivityType.Internal,
            })),
        };
    },

    async update(row, previousRow, props, context) {
        const festivalId = context.event.integrations?.anPlanFestivalId;
        if (!festivalId)
            notFound();

        const dbInstance = db;
        const affectedRows = await dbInstance.update(tActivitiesLocations)
            .set({
                locationName: !!row.displayName ? row.displayName : 'Unknown location',
                locationDisplayName: !!row.displayName ? row.displayName : null,
                locationAreaId: row.areaId,
                locationUpdated: dbInstance.currentZonedDateTime(),
            })
            .where(tActivitiesLocations.locationFestivalId.equals(festivalId))
                .and(tActivitiesLocations.locationId.equals(row.id))
                .and(tActivitiesLocations.locationDeleted.isNull())
            .executeUpdate();

        if (!affectedRows)
            return false;

        ScheduleCache.clear('program', festivalId);

        await dbInstance.insertInto(tActivitiesLogs)
            .set({
                festivalId,
                locationId: row.id,
                mutation: kMutation.Updated,
                mutationFields: 'area, display name',
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
                entityType: 'location',
            });

        // Provide a value update for the area name associated with this location:
        const areaName = await dbInstance.selectFrom(tActivitiesAreas)
            .where(tActivitiesAreas.areaId.equals(row.areaId || -1))
            .selectOneColumn(tActivitiesAreas.areaDisplayName.valueWhenNull(
                tActivitiesAreas.areaName))
            .executeSelectNoneOrOne();

        return {
            ...row,
            area: areaName || 'Unknown area',
        };
    },
});

/**
 * The <ProgramLocationsPage> component contains the locations that are part of the event's venue.
 */
export default async function ProgramLocationsPage(
    props: PageProps<'/admin/events/[event]/program/locations'>)
{
    const { event } = await requireAuthenticationWithEvent(props);
    if (!event.integrations?.anPlanFestivalId)
        notFound();

    const areas = await db.selectFrom(tActivitiesAreas)
        .where(tActivitiesAreas.areaFestivalId.equals(event.integrations.anPlanFestivalId))
            .and(tActivitiesAreas.areaDeleted.isNull())
        .select({
            value: tActivitiesAreas.areaId,
            label: tActivitiesAreas.areaDisplayName.valueWhenNull(tActivitiesAreas.areaName),
        })
        .orderBy('label', 'asc')
        .executeSelectMany();

    const columns: Column<ExtractRowModel<typeof programLocationsDataSource>>[] = [
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
            headerName: 'Location name',
            flex: 1,
            editable: false,
            sortable: true,
        },
        {
            field: 'displayName',
            headerName: 'Display name',
            editable: true,
            flex: 1,
            sortable: true,

            editorProps: {
                required: true,
            },

            template: 'component',
            templateProps: {
                component: DisplayNameCell,
            },
        },
        {
            field: 'areaId',
            headerName: 'Area',
            editable: true,
            flex: 1,
            sortable: true,

            type: 'singleSelect',
            valueOptions: areas,

            editorProps: {
                required: true,
            },

            template: 'component',
            templateProps: {
                component: LocationAreaCell,
            },
        },
    ];

    return (
        <>
            <Section icon={ <LocationOnIcon color="primary" /> } title="Locations"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: 'Program', href: `/admin/events/${event.slug}/program` },
                         { label: 'Locations' },
                     ]}>
                <SectionIntroduction>
                    Locations and rooms configured for {event.shortName} in AnPlan.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                <DataTable columns={columns} source={programLocationsDataSource}
                           context={{ event: event.slug }}
                           defaultSort={{ field: 'name', sort: 'asc' }}
                           protectedColumn="isProtected" subject="location"
                           search="prominent" disableFooter pageSize={100}
                           listViewProps={{
                               primaryField: 'displayName',
                               secondaryField: 'area',
                           }} />
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Locations', 'Program', { event: 'event' });
