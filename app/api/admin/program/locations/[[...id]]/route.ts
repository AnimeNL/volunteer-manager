// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { type DataTableEndpoints, createDataTableApi } from '../../../../createDataTableApi';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { ScheduleCache } from '@app/api/event/schedule/ScheduleCache';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { getAnPlanLocationUrl } from '@lib/AnPlan';
import { getEventBySlug } from '@lib/EventLoader';
import db, { tActivitiesAreas, tActivitiesLogs, tActivitiesLocations } from '@lib/database';

import { kActivityType, kMutation, kMutationSeverity } from '@lib/database/Types';

/**
 * Row model of a program's location.
 */
const kProgramLocationRowModel = z.object({
    /**
     * Unique ID of this location.
     */
    id: z.number(),

    /**
     * Type of location this entails, i.e. sourced from AnPlan or internal to our system.
     */
    type: z.enum(kActivityType),

    /**
     * Name of the location, which does not have to be its display name.
     */
    name: z.string(),

    /**
     * Display name of the location, as it should be presented to volunteers.
     */
    displayName: z.string().optional(),

    /**
     * Unique ID of the area that this location is located in.
     */
    area: z.number(),

    /**
     * Link to this location in AnPlan, when one exists and can be created.
     */
    anplanLink: z.string().optional(),
});

/**
 * Program locations are specific to a given festival.
 */
const kProgramLocationContext = z.object({
    context: z.object({
        /**
         * Name of the event which is being consulted.
         */
        event: z.string(),
    }),
});

/**
 * Export type definitions so that the API can be used in `callApi()`.
 */
export type ProgramLocationsEndpoints =
    DataTableEndpoints<typeof kProgramLocationRowModel, typeof kProgramLocationContext>;

/**
 * Export type definition for the API's Row Model.
 */
export type ProgramLocationsRowModel = z.infer<typeof kProgramLocationRowModel>;

/**
 * Export type definition for the API's context.
 */
export type ProgramLocationsContext = z.infer<typeof kProgramLocationContext>;

/**
 * Offset to use for internal Location IDs, to avoid overlap with AnPlan data.
 */
const kInternalLocationIdOffset = 1_000_000;

/**
 * The Program Locations API is implemented as a regular DataTable API.
 * The following endpoints are provided by this implementation:
 *
 *     DELETE /api/admin/program/locations/:id
 *     GET    /api/admin/program/locations
 *     POST   /api/admin/program/locations
 *     PUT    /api/admin/program/locations/:id
 *
 */
export const { DELETE, GET, POST, PUT } =
createDataTableApi(kProgramLocationRowModel, kProgramLocationContext, {
    async accessCheck({ context }, action, props) {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin-event',
            event: context.event,
        });
    },

    async create({ context, row }, props) {
        const event = await getEventBySlug(context.event);
        if (!event || !event.festivalId)
            notFound();

        const firstAreaId = await db.selectFrom(tActivitiesAreas)
            .where(tActivitiesAreas.areaFestivalId.equals(event.festivalId))
                .and(tActivitiesAreas.areaDeleted.isNull())
            .selectOneColumn(tActivitiesAreas.areaId).limit(1)
            .executeSelectNoneOrOne();

        if (!firstAreaId)
            return { success: false, error: 'There are no areas for the location to exist in…' };

        const highestInternalLocationId = await db.selectFrom(tActivitiesLocations)
            .where(tActivitiesLocations.locationId.greaterThan(kInternalLocationIdOffset))
            .selectOneColumn(tActivitiesLocations.locationId)
            .orderBy(tActivitiesLocations.locationId, 'desc').limit(1)
            .executeSelectNoneOrOne();

        const newInternalLocationId = (highestInternalLocationId ?? kInternalLocationIdOffset) + 1;
        const newDisplayInternalLocationId = newInternalLocationId - kInternalLocationIdOffset;

        const dbInstance = db;
        const insertedRows = await dbInstance.insertInto(tActivitiesLocations)
            .set({
                locationId: newInternalLocationId,
                locationFestivalId: event.festivalId,
                locationType: kActivityType.Internal,
                locationName: `Internal location #${newDisplayInternalLocationId}`,
                locationAreaId: firstAreaId,
                locationCreated: dbInstance.currentZonedDateTime(),
                locationUpdated: dbInstance.currentZonedDateTime(),
            })
            .executeInsert();

        if (!insertedRows)
            return { success: false, error: 'Unable to write the new location to the database…' };

        ScheduleCache.clear('program', event.festivalId);

        await dbInstance.insertInto(tActivitiesLogs)
            .set({
                festivalId: event.festivalId,
                locationId: newInternalLocationId,
                mutation: kMutation.Created,
                mutationSeverity: kMutationSeverity.Important,
                mutationUserId: props.user?.id,
                mutationDate: dbInstance.currentZonedDateTime(),
            })
            .executeInsert();

        return {
            success: true,
            row: {
                id: newInternalLocationId,
                type: kActivityType.Internal,
                name: `Internal location #${newDisplayInternalLocationId}`,
                area: firstAreaId,
            },
        };
    },

    async delete({ context, id }, props) {
        const event = await getEventBySlug(context.event);
        if (!event || !event.festivalId)
            notFound();

        const dbInstance = db;
        const affectedRows = await dbInstance.update(tActivitiesLocations)
            .set({
                locationDeleted: dbInstance.currentZonedDateTime(),
            })
            .where(tActivitiesLocations.locationFestivalId.equals(event.festivalId))
                .and(tActivitiesLocations.locationId.equals(id))
                .and(tActivitiesLocations.locationType.equals(kActivityType.Internal))
                .and(tActivitiesLocations.locationDeleted.isNull())
            .executeUpdate();

        ScheduleCache.clear('program', event.festivalId);

        await dbInstance.insertInto(tActivitiesLogs)
            .set({
                festivalId: event.festivalId,
                locationId: id,
                mutation: kMutation.Deleted,
                mutationSeverity: kMutationSeverity.Important,
                mutationUserId: props.user?.id,
                mutationDate: dbInstance.currentZonedDateTime(),
            })
            .executeInsert();

        return { success: !!affectedRows };
    },

    async list({ context, sort }) {
        const event = await getEventBySlug(context.event);
        if (!event || !event.festivalId)
            notFound();

        let sortingKey: 'id' | 'type' | 'name' | 'displayName' | 'area' | undefined;
        switch (sort?.field) {
            case 'id':
            case 'type':
            case 'name':
            case 'displayName':
            case 'area':
                sortingKey = sort.field;
                break;
        }

        const locations = await db.selectFrom(tActivitiesLocations)
            .where(tActivitiesLocations.locationFestivalId.equals(event.festivalId))
                .and(tActivitiesLocations.locationDeleted.isNull())
            .select({
                id: tActivitiesLocations.locationId,
                type: tActivitiesLocations.locationType,
                name: tActivitiesLocations.locationName,
                displayName: tActivitiesLocations.locationDisplayName,
                area: tActivitiesLocations.locationAreaId,
            })
            .orderBy(sortingKey ?? 'name', sort?.sort ?? 'desc')
            .executeSelectPage();

        return {
            success: true,
            rowCount: locations.count,
            rows: locations.data.map(location => ({
                ...location,
                anplanLink: getAnPlanLocationUrl(location.id),
            })),
        };
    },

    async update({ context, id, row }, props) {
        const event = await getEventBySlug(context.event);
        if (!event || !event.festivalId)
            notFound();

        const dbInstance = db;
        const affectedRows = await dbInstance.update(tActivitiesLocations)
            .set({
                locationDisplayName: !!row.displayName ? row.displayName : undefined,
                locationAreaId: row.area,
            })
            .where(tActivitiesLocations.locationFestivalId.equals(event.festivalId))
                .and(tActivitiesLocations.locationId.equals(id))
                .and(tActivitiesLocations.locationType.equals(kActivityType.Internal))
            .executeUpdate();

        ScheduleCache.clear('program', event.festivalId);

        await dbInstance.insertInto(tActivitiesLogs)
            .set({
                festivalId: event.festivalId,
                locationId: id,
                mutation: kMutation.Updated,
                mutationFields: 'area, display name',
                mutationSeverity: kMutationSeverity.Important,
                mutationUserId: props.user?.id,
                mutationDate: dbInstance.currentZonedDateTime(),
            })
            .executeInsert();

        return { success: !!affectedRows };
    },

    async writeLog({ context, id }, mutation, props) {
        const event = await getEventBySlug(context.event);
        const locationName = await db.selectFrom(tActivitiesLocations)
            .where(tActivitiesLocations.locationId.equals(id))
            .selectOneColumn(tActivitiesLocations.locationDisplayName.valueWhenNull(
                tActivitiesLocations.locationName))
            .executeSelectNoneOrOne();

        RecordLog({
            type: kLogType.AdminProgramMutation,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            data: {
                event: event?.shortName,
                entityType: 'location',
                entity: locationName,
                mutation
            },
        });
    },
});

export const dynamic = 'force-dynamic';
