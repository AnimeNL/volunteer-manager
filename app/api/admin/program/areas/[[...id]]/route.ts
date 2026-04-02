// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { type DataTableEndpoints, createDataTableApi } from '../../../../createDataTableApi';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { ScheduleCache } from '@app/api/event/schedule/ScheduleCache';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { getAnPlanAreaUrl } from '@lib/AnPlan';
import { getEventBySlug } from '@lib/EventLoader';
import db, { tActivitiesAreas, tActivitiesLogs } from '@lib/database';

import { kActivityType, kMutation, kMutationSeverity } from '@lib/database/Types';

/**
 * Row model of a program's area.
 */
const kProgramAreaRowModel = z.object({
    /**
     * Unique ID of this area.
     */
    id: z.number(),

    /**
     * Type of area this entails, i.e. sourced from AnPlan or internal to our system.
     */
    type: z.enum(kActivityType),

    /**
     * Name of the area, which does not have to be its display name.
     */
    name: z.string(),

    /**
     * Display name of the area, as it should be presented to volunteers.
     */
    displayName: z.string().optional(),

    /**
     * Link to this area in AnPlan, when one exists and can be created.
     */
    anplanLink: z.string().optional(),
});

/**
 * Program areas are specific to a given festival.
 */
const kProgramAreaContext = z.object({
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
export type ProgramAreasEndpoints =
    DataTableEndpoints<typeof kProgramAreaRowModel, typeof kProgramAreaContext>;

/**
 * Export type definition for the API's Row Model.
 */
export type ProgramAreasRowModel = z.infer<typeof kProgramAreaRowModel>;

/**
 * Export type definition for the API's context.
 */
export type ProgramAreasContext = z.infer<typeof kProgramAreaContext>;

/**
 * Offset to use for internal Area IDs, to avoid overlap with AnPlan data.
 */
const kInternalAreaIdOffset = 1_000_000;

/**
 * The Program Areas API is implemented as a regular DataTable API.
 * The following endpoints are provided by this implementation:
 *
 *     DELETE /api/admin/program/areas/:id
 *     GET    /api/admin/program/areas
 *     POST   /api/admin/program/areas
 *     PUT    /api/admin/program/areas/:id
 *
 */
export const { DELETE, GET, POST, PUT } =
createDataTableApi(kProgramAreaRowModel, kProgramAreaContext, {
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

        const highestInternalAreaId = await db.selectFrom(tActivitiesAreas)
            .where(tActivitiesAreas.areaId.greaterThan(kInternalAreaIdOffset))
            .selectOneColumn(tActivitiesAreas.areaId)
            .orderBy(tActivitiesAreas.areaId, 'desc').limit(1)
            .executeSelectNoneOrOne();

        const newInternalAreaId = (highestInternalAreaId ?? kInternalAreaIdOffset) + 1;
        const newDisplayInternalAreaId = newInternalAreaId - kInternalAreaIdOffset;

        const dbInstance = db;
        const insertedRows = await dbInstance.insertInto(tActivitiesAreas)
            .set({
                areaId: newInternalAreaId,
                areaFestivalId: event.festivalId,
                areaType: kActivityType.Internal,
                areaName: `Internal area #${newDisplayInternalAreaId}`,
                areaCreated: dbInstance.currentZonedDateTime(),
                areaUpdated: dbInstance.currentZonedDateTime(),
            })
            .executeInsert();

        if (!insertedRows)
            return { success: false, error: 'Unable to write the new area to the database…' };

        ScheduleCache.clear('program', event.festivalId);

        await dbInstance.insertInto(tActivitiesLogs)
            .set({
                festivalId: event.festivalId,
                areaId: newInternalAreaId,
                mutation: kMutation.Created,
                mutationSeverity: kMutationSeverity.Important,
                mutationUserId: props.user?.id,
                mutationDate: dbInstance.currentZonedDateTime(),
            })
            .executeInsert();

        return {
            success: true,
            row: {
                id: newInternalAreaId,
                type: kActivityType.Internal,
                name: `Internal area #${newDisplayInternalAreaId}`,
            },
        };
    },

    async delete({ context, id }, props) {
        const event = await getEventBySlug(context.event);
        if (!event || !event.festivalId)
            notFound();

        const dbInstance = db;
        const affectedRows = await dbInstance.update(tActivitiesAreas)
            .set({
                areaDeleted: dbInstance.currentZonedDateTime(),
            })
            .where(tActivitiesAreas.areaFestivalId.equals(event.festivalId))
                .and(tActivitiesAreas.areaId.equals(id))
                .and(tActivitiesAreas.areaType.equals(kActivityType.Internal))
                .and(tActivitiesAreas.areaDeleted.isNull())
            .executeUpdate();

        ScheduleCache.clear('program', event.festivalId);

        await dbInstance.insertInto(tActivitiesLogs)
            .set({
                festivalId: event.festivalId,
                areaId: id,
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

        let sortingKey: 'id' | 'type' | 'name' | 'displayName' | undefined;
        switch (sort?.field) {
            case 'id':
            case 'type':
            case 'name':
            case 'displayName':
                sortingKey = sort.field;
                break;
        }

        const areas = await db.selectFrom(tActivitiesAreas)
            .where(tActivitiesAreas.areaFestivalId.equals(event.festivalId))
                .and(tActivitiesAreas.areaDeleted.isNull())
            .select({
                id: tActivitiesAreas.areaId,
                type: tActivitiesAreas.areaType,
                name: tActivitiesAreas.areaName,
                displayName: tActivitiesAreas.areaDisplayName,
            })
            .orderBy(sortingKey ?? 'name', sort?.sort ?? 'desc')
            .executeSelectPage();

        return {
            success: true,
            rowCount: areas.count,
            rows: areas.data.map(area => ({
                ...area,
                anplanLink: getAnPlanAreaUrl(area.id),
            })),
        };
    },

    async update({ context, id, row }, props) {
        const event = await getEventBySlug(context.event);
        if (!event || !event.festivalId)
            notFound();

        const dbInstance = db;
        const affectedRows = await dbInstance.update(tActivitiesAreas)
            .set({
                areaDisplayName: !!row.displayName ? row.displayName : undefined,
            })
            .where(tActivitiesAreas.areaFestivalId.equals(event.festivalId))
                .and(tActivitiesAreas.areaId.equals(id))
                .and(tActivitiesAreas.areaType.equals(kActivityType.Internal))
            .executeUpdate();

        ScheduleCache.clear('program', event.festivalId);

        await dbInstance.insertInto(tActivitiesLogs)
            .set({
                festivalId: event.festivalId,
                areaId: id,
                mutation: kMutation.Updated,
                mutationFields: 'display name',
                mutationSeverity: kMutationSeverity.Important,
                mutationUserId: props.user?.id,
                mutationDate: dbInstance.currentZonedDateTime(),
            })
            .executeInsert();

        return { success: !!affectedRows };
    },

    async writeLog({ context, id }, mutation, props) {
        const event = await getEventBySlug(context.event);
        const locationName = await db.selectFrom(tActivitiesAreas)
            .where(tActivitiesAreas.areaId.equals(id))
            .selectOneColumn(tActivitiesAreas.areaDisplayName.valueWhenNull(
                tActivitiesAreas.areaName))
            .executeSelectNoneOrOne();

        RecordLog({
            type: kLogType.AdminProgramMutation,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            data: {
                event: event?.shortName,
                entityType: 'area',
                entity: locationName,
                mutation
            },
        });
    },
});

export const dynamic = 'force-dynamic';
