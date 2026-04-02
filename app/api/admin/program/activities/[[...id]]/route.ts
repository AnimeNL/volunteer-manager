// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { type DataTableEndpoints, createDataTableApi } from '../../../../createDataTableApi';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { ScheduleCache } from '@app/api/event/schedule/ScheduleCache';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { getAnPlanActivityUrl } from '@lib/AnPlan';
import { getEventBySlug } from '@lib/EventLoader';
import db, { tActivities, tActivitiesLocations, tActivitiesLogs, tActivitiesTimeslots, tShifts } from '@lib/database';

import { kActivityType, kMutation, kMutationSeverity } from '@lib/database/Types';

/**
 * Row model of a program's activities.
 */
const kProgramActivityRowModel = z.object({
    /**
     * Unique ID of this activity.
     */
    id: z.number(),

    /**
     * Type of this activity, i.e. sourced from AnPlan or internal to our system.
     */
    type: z.enum(kActivityType),

    /**
     * Title of the activity.
     */
    title: z.string(),

    /**
     * Location in which the activity will be hosted. May be an arbitrary string when there either
     * are multiple locations, or no locations at all.
     */
    location: z.string(),
    locationId: z.number().optional(),

    /**
     * Number of timeslots that have been scheduled for this particular activity.
     */
    timeslots: z.number(),

    /**
     * Whether volunteering help was requested by the organisers of this activity.
     */
    helpRequested: z.boolean(),

    /**
     * Whether one or more shifts have been scheduled for this activity.
     */
    shiftScheduled: z.boolean(),

    /**
     * Whether the activity is visible to the public, or private to the organisation.
     */
    visible: z.boolean(),

    /**
     * Link to this activity in AnPlan, only when it's sourced from the program.
     */
    anplanLink: z.string().optional(),
});

/**
 * Program activities are specific to a given festival.
 */
const kProgramActivityContext = z.object({
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
export type ProgramActivitiesEndpoints =
    DataTableEndpoints<typeof kProgramActivityRowModel, typeof kProgramActivityContext>;

/**
 * Export type definition for the API's Row Model.
 */
export type ProgramActivitiesRowModel = z.infer<typeof kProgramActivityRowModel>;

/**
 * Export type definition for the API's context.
 */
export type ProgramActivitiesContext = z.infer<typeof kProgramActivityContext>;

/**
 * Offset to use for internal Activity IDs, to avoid overlap with AnPlan data.
 */
const kInternalActivityIdOffset = 10_000_000;

/**
 * The Program Activities API is implemented as a regular DataTable API.
 * The following endpoints are provided by this implementation:
 *
 *     DELETE /api/admin/program/activities/:id
 *     GET    /api/admin/program/activities
 *     POST   /api/admin/program/activities
 *     PUT    /api/admin/program/activities/:id
 *
 */
export const { DELETE, GET, POST, PUT } =
createDataTableApi(kProgramActivityRowModel, kProgramActivityContext, {
    async accessCheck({ context }, action, props) {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin-event',
            event: context.event,
        });
    },

    async create({ context }, props) {
        const event = await getEventBySlug(context.event);
        if (!event || !event.festivalId)
            notFound();

        const highestInternalActivityId = await db.selectFrom(tActivities)
            .where(tActivities.activityId.greaterThan(kInternalActivityIdOffset))
            .selectOneColumn(tActivities.activityId)
            .orderBy(tActivities.activityId, 'desc').limit(1)
            .executeSelectNoneOrOne();

        const newInternalActivityId = (highestInternalActivityId ?? kInternalActivityIdOffset) + 1;
        const newDisplayInternalActivityId = newInternalActivityId - kInternalActivityIdOffset;

        const dbInstance = db;
        const insertedRows = await dbInstance.insertInto(tActivities)
            .set({
                activityId: newInternalActivityId,
                activityFestivalId: event.festivalId,
                activityType: kActivityType.Internal,
                activityTitle: `Internal activity #${newDisplayInternalActivityId}`,
                activityHelpNeeded: /* true= */ 1,
                activityTypeAdultsOnly: /* false= */ 0,
                activityTypeCompetition: /* false= */ 0,
                activityTypeCosplay: /* false= */ 0,
                activityTypeEvent: /* false= */ 0,
                activityTypeGameRoom: /* false= */ 0,
                activityTypeVideo: /* false= */ 0,
                activityVisible: /* false= */ 0,
                activityVisibleReason: 'Internal to the Volunteer Manager',
                activityCreated: dbInstance.currentZonedDateTime(),
                activityUpdated: dbInstance.currentZonedDateTime(),
            })
            .executeInsert();

        if (!insertedRows)
            return { success: false, error: 'Unable to write the new activity to the database…' };

        ScheduleCache.clear('program', event.festivalId);

        await dbInstance.insertInto(tActivitiesLogs)
            .set({
                festivalId: event.festivalId,
                activityId: newInternalActivityId,
                mutation: kMutation.Created,
                mutationSeverity: kMutationSeverity.Important,
                mutationUserId: props.user?.id,
                mutationDate: dbInstance.currentZonedDateTime(),
            })
            .executeInsert();

        return {
            success: true,
            row: {
                id: newInternalActivityId,
                type: kActivityType.Internal,
                title: `Internal activity #${newDisplayInternalActivityId}`,
                location: 'No locations…',
                timeslots: 0,
                helpRequested: true,
                shiftScheduled: false,
                visible: false,
            },
        };
    },

    async delete({ context, id }, props) {
        const event = await getEventBySlug(context.event);
        if (!event || !event.festivalId)
            notFound();

        const dbInstance = db;
        const affectedRows = await dbInstance.update(tActivities)
            .set({
                activityDeleted: dbInstance.currentZonedDateTime(),
            })
            .where(tActivities.activityFestivalId.equals(event.festivalId))
                .and(tActivities.activityId.equals(id))
                .and(tActivities.activityType.equals(kActivityType.Internal))
                .and(tActivities.activityDeleted.isNull())
            .executeUpdate();

        ScheduleCache.clear('program', event.festivalId);

        await dbInstance.insertInto(tActivitiesLogs)
            .set({
                festivalId: event.festivalId,
                activityId: id,
                mutation: kMutation.Deleted,
                mutationSeverity: kMutationSeverity.Important,
                mutationUserId: props.user?.id,
                mutationDate: dbInstance.currentZonedDateTime(),
            })
            .executeInsert();

        return { success: !!affectedRows };
    },

    async list({ context, pagination, sort }) {
        const event = await getEventBySlug(context.event);
        if (!event || !event.festivalId)
            notFound();

        const activitiesLocationsJoin = tActivitiesLocations.forUseInLeftJoin();
        const activitiesLocationsInternalJoin = tActivitiesLocations.forUseInLeftJoinAs('al');
        const activitiesTimeslotsJoin = tActivitiesTimeslots.forUseInLeftJoin();
        const shiftsJoin = tShifts.forUseInLeftJoin();

        let sortField: 'title' | 'helpRequested' | 'shiftScheduled' | 'visible' = 'title';
        const sortDirection = sort?.sort ?? 'asc';

        switch (sort?.field) {
            case 'title':
            case 'helpRequested':
            case 'shiftScheduled':
            case 'visible':
                sortField = sort.field;
                break;
        }

        const dbInstance = db;
        const activities = await dbInstance.selectFrom(tActivities)
            .leftJoin(activitiesTimeslotsJoin)
                .on(activitiesTimeslotsJoin.activityId.equals(tActivities.activityId))
            .leftJoin(activitiesLocationsJoin)
                .on(activitiesLocationsJoin.locationId.equals(
                    activitiesTimeslotsJoin.timeslotLocationId))
            .leftJoin(activitiesLocationsInternalJoin)
                .on(activitiesLocationsInternalJoin.locationId.equals(
                    tActivities.activityLocationId))
            .leftJoin(shiftsJoin)
                .on(shiftsJoin.shiftActivityId.equals(tActivities.activityId))
            .where(tActivities.activityFestivalId.equals(event.festivalId))
                .and(tActivities.activityDeleted.isNull())
            .select({
                id: tActivities.activityId,
                title: tActivities.activityTitle,
                type: tActivities.activityType,

                // For internal activities only:
                locationId: activitiesLocationsInternalJoin.locationId,
                locationName: activitiesLocationsInternalJoin.locationDisplayName.valueWhenNull(
                    activitiesLocationsInternalJoin.locationName),

                timeslots: dbInstance.aggregateAsArray({
                    locationId: activitiesLocationsJoin.locationId,
                    locationName: activitiesLocationsJoin.locationDisplayName.valueWhenNull(
                        activitiesLocationsJoin.locationName),
                }),

                helpRequested: tActivities.activityHelpNeeded,
                shiftScheduled: dbInstance.countDistinct(shiftsJoin.shiftId),
                visible: tActivities.activityVisible,
            })
            .groupBy(tActivities.activityId)
            .orderBy('type', 'desc')
                .orderBy(sortField, sortDirection)
            .limitIfValue(pagination ? pagination.pageSize : null)
                .offsetIfValue(pagination ? pagination.page * pagination.pageSize : null)
            .executeSelectPage();

        return {
            success: true,
            rowCount: activities.count,
            rows: activities.data.map(activity => {
                let anplanLink: string | undefined;
                if (activity.type === kActivityType.Program)
                    anplanLink = getAnPlanActivityUrl(activity.id);

                let location: string = 'No locations…';
                let locationId: number | undefined;

                if (activity.type === kActivityType.Internal && !!activity.locationName) {
                    location = activity.locationName;
                    locationId = activity.locationId;
                } else if (!!activity.timeslots.length) {
                    const uniqueLocations = new Set<number>();
                    for (const { locationId } of activity.timeslots)
                        uniqueLocations.add(locationId);

                    if (uniqueLocations.size === 1) {
                        location = activity.timeslots[0].locationName;
                        locationId = activity.timeslots[0].locationId;
                    } else {
                        location = `${uniqueLocations.size} locations`;
                    }
                }

                return {
                    id: activity.id,
                    type: activity.type,
                    title: activity.title,
                    location,
                    locationId,
                    timeslots: activity.timeslots.length,
                    helpRequested: !!activity.helpRequested,
                    shiftScheduled: !!activity.shiftScheduled,
                    visible: !!activity.visible,
                    anplanLink,
                }
            }),
        };
    },

    async update({ context, id, row }, props) {
        const event = await getEventBySlug(context.event);
        if (!event || !event.festivalId)
            notFound();

        const dbInstance = db;
        const affectedRows = await dbInstance.update(tActivities)
            .set({
                activityTitle: row.title,
                activityLocationId: row.locationId || null,
                activityUpdated: dbInstance.currentZonedDateTime(),
            })
            .where(tActivities.activityId.equals(id))
                .and(tActivities.activityFestivalId.equals(event.festivalId))
                .and(tActivities.activityType.equals(kActivityType.Internal))
                .and(tActivities.activityDeleted.isNull())
            .executeUpdate();

        if (!!affectedRows) {
            ScheduleCache.clear('program', event.festivalId);

            await dbInstance.insertInto(tActivitiesLogs)
                .set({
                    festivalId: event.festivalId,
                    activityId: id,
                    mutation: kMutation.Updated,
                    mutationFields: 'title, location',
                    mutationSeverity: kMutationSeverity.Important,
                    mutationUserId: props.user?.id,
                    mutationDate: dbInstance.currentZonedDateTime(),
                })
                .executeInsert();
        }

        return { success: !!affectedRows };
    },

    async writeLog({ context, id }, mutation, props) {
        const event = await getEventBySlug(context.event);
        const activityName = await db.selectFrom(tActivities)
            .where(tActivities.activityId.equals(id))
                .and(tActivities.activityType.equals(kActivityType.Internal))
            .selectOneColumn(tActivities.activityTitle)
            .executeSelectNoneOrOne();

        RecordLog({
            type: kLogType.AdminProgramMutation,
            severity: kLogSeverity.Warning,
            sourceUser: props.user,
            data: {
                event: event?.shortName,
                entityType: 'activity',
                entity: activityName,
                mutation
            },
        });
    },
});

export const dynamic = 'force-dynamic';
