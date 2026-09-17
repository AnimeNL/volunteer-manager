// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import EventNoteIcon from '@mui/icons-material/EventNote';

import type { Column, ExtractRowModel } from '@app/admin/components/DataTable';
import { HistorySection } from '../HistorySection';
import { ActivityLocationCell, ActivityTitleCell, AnPlanLinkCell, AnPlanLinkHeader,
    HelpRequestedCell, HelpRequestedHeader, VisibleCell, VisibleHeader } from '../ProgramCells';
import { DataTable, createDataSource, kEventTransformer, withContext, withRowModel }
    from '@app/admin/components/DataTable';
import { LogBuilder } from '@lib/log/index';
import { ScheduleCache } from '@app/api/event/schedule/ScheduleCache';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { getAnPlanActivityUrl } from '@lib/AnPlan';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';
import db, { tActivities, tActivitiesLocations, tActivitiesLogs, tActivitiesTimeslots,
    tShifts } from '@lib/database';

import { kActivityType, kMutation, kMutationSeverity } from '@lib/database/Types';

/**
 * Offset to use for internal Activity IDs, to avoid overlap with AnPlan data.
 */
const kInternalActivityIdOffset = 10_000_000;

/**
 * Data source for activities that are part of an event's program.
 */
const programActivitiesDataSource = createDataSource('admin/event/program/activities', withContext({
    /**
     * Event for which activities are being displayed.
     */
    event: kEventTransformer,

}), withRowModel({
    /**
     * Unique ID of the activity.
     */
    id: z.number(),

    /**
     * Title of the activity.
     */
    title: z.string().nonempty(),

    /**
     * Location where the activity takes place.
     */
    location: z.string(),

    /**
     * Unique ID of the assigned location (for internal activities).
     */
    locationId: z.number().nullish(),

    /**
     * Number of timeslots scheduled for this activity.
     */
    timeslots: z.number(),

    /**
     * Whether volunteering help was requested.
     */
    helpRequested: z.boolean(),

    /**
     * Whether volunteering shifts have been scheduled.
     */
    shiftScheduled: z.boolean(),

    /**
     * Whether the activity is published and visible.
     */
    visible: z.boolean(),

    /**
     * Link to the activity in AnPlan, when sourced externally.
     */
    anplanLink: z.string().optional(),

    /**
     * Whether the row is frozen from editing (AnPlan activities).
     */
    isFrozen: z.boolean(),

    /**
     * Whether the row is protected from deletion (AnPlan activities).
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
            return false;

        if (!partialRow.locationId || !partialRow.title)
            return false;

        const dbInstance = db;
        const highestInternalActivityId = await dbInstance.selectFrom(tActivities)
            .where(tActivities.activityId.greaterThan(kInternalActivityIdOffset))
            .selectOneColumn(tActivities.activityId)
            .orderBy(tActivities.activityId, 'desc').limit(1)
            .executeSelectNoneOrOne();

        const newInternalActivityId = (highestInternalActivityId ?? kInternalActivityIdOffset) + 1;

        const insertedRows = await dbInstance.insertInto(tActivities)
            .set({
                activityId: newInternalActivityId,
                activityFestivalId: festivalId,
                activityType: kActivityType.Internal,
                activityTitle: partialRow.title,
                activityLocationId: partialRow.locationId,
                activityHelpNeeded: !!partialRow.helpRequested ? 1 : 0,
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
            return false;

        ScheduleCache.clear('program', festivalId);

        await dbInstance.insertInto(tActivitiesLogs)
            .set({
                festivalId,
                activityId: newInternalActivityId,
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
                entity: partialRow.title,
                entityType: 'activity',
            });

        return true;
    },

    async delete(row, props, context) {
        const festivalId = context.event.integrations?.anPlanFestivalId;
        if (!festivalId)
            return false;

        const dbInstance = db;
        const affectedRows = await dbInstance.update(tActivities)
            .set({
                activityDeleted: dbInstance.currentZonedDateTime(),
            })
            .where(tActivities.activityFestivalId.equals(festivalId))
                .and(tActivities.activityId.equals(row.id))
                .and(tActivities.activityType.equals(kActivityType.Internal))
                .and(tActivities.activityDeleted.isNull())
            .executeUpdate();

        if (!affectedRows)
            return false;

        ScheduleCache.clear('program', festivalId);

        await dbInstance.insertInto(tActivitiesLogs)
            .set({
                festivalId,
                activityId: row.id,
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
                entity: row.title,
                entityType: 'activity',
            });

        return true;
    },

    async list(params, props, context) {
        const festivalId = context.event.integrations?.anPlanFestivalId;
        if (!festivalId)
            return notFound();

        const activitiesLocationsJoin = tActivitiesLocations.forUseInLeftJoin();
        const activitiesLocationsInternalJoin = tActivitiesLocations.forUseInLeftJoinAs('al');
        const activitiesTimeslotsJoin = tActivitiesTimeslots.forUseInLeftJoin();
        const shiftsJoin = tShifts.forUseInLeftJoin();

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
            .where(tActivities.activityFestivalId.equals(festivalId))
                .and(tActivities.activityDeleted.isNull())
                .and(tActivities.activityTitle.containsInsensitiveIfValue(params.search)
                    .or(activitiesLocationsJoin.locationName.containsInsensitiveIfValue(
                        params.search)
                    .or(activitiesLocationsInternalJoin.locationName.containsInsensitiveIfValue(
                        params.search))))
            .select({
                id: tActivities.activityId,
                title: tActivities.activityTitle,
                type: tActivities.activityType,

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
            .orderBy(tActivities.activityType, 'desc')
                .orderBy(params.sort.field as any ?? 'title', params.sort.direction)
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        return {
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
                    for (const timeslot of activity.timeslots)
                        uniqueLocations.add(timeslot.locationId);

                    if (uniqueLocations.size === 1) {
                        location = activity.timeslots[0].locationName;
                        locationId = activity.timeslots[0].locationId;
                    } else {
                        location = `${uniqueLocations.size} locations`;
                    }
                }

                return {
                    id: activity.id,
                    title: activity.title,
                    location,
                    locationId,
                    timeslots: activity.timeslots.length,
                    helpRequested: !!activity.helpRequested,
                    shiftScheduled: !!activity.shiftScheduled,
                    visible: !!activity.visible,
                    anplanLink,

                    isFrozen: activity.type !== kActivityType.Internal,
                    isProtected: activity.type !== kActivityType.Internal,
                };
            }),
        };
    },

    async update(row, previousRow, props, context) {
        const festivalId = context.event.integrations?.anPlanFestivalId;
        if (!festivalId)
            return false;

        const dbInstance = db;
        const affectedRows = await dbInstance.update(tActivities)
            .set({
                activityTitle: row.title,
                activityLocationId: row.locationId || null,
                activityHelpNeeded: row.helpRequested ? 1 : 0,
                activityUpdated: dbInstance.currentZonedDateTime(),
            })
            .where(tActivities.activityId.equals(row.id))
                .and(tActivities.activityFestivalId.equals(festivalId))
                .and(tActivities.activityType.equals(kActivityType.Internal))
                .and(tActivities.activityDeleted.isNull())
            .executeUpdate();

        if (!affectedRows)
            return false;

        ScheduleCache.clear('program', festivalId);

        await dbInstance.insertInto(tActivitiesLogs)
            .set({
                festivalId,
                activityId: row.id,
                mutation: kMutation.Updated,
                mutationFields: 'title, location',
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
                entity: row.title,
                entityType: 'activity',
            });

        // Provide a value update for the location name associated with this activity:
        const locationName = await dbInstance.selectFrom(tActivitiesLocations)
            .where(tActivitiesLocations.locationId.equals(row.locationId || -1))
            .selectOneColumn(tActivitiesLocations.locationDisplayName.valueWhenNull(
                tActivitiesLocations.locationName))
            .executeSelectNoneOrOne();

        return {
            ...row,
            location: locationName || 'No locations…',
        };
    },
});

/**
 * The <ProgramActivitiesPage> component lists all activities part of the event's program.
 */
export default async function ProgramActivitiesPage(
    props: PageProps<'/admin/events/[event]/program/activities'>)
{
    const { event } = await requireAuthenticationWithEvent(props);
    if (!event.integrations?.anPlanFestivalId)
        notFound();

    const locations = await db.selectFrom(tActivitiesLocations)
        .where(tActivitiesLocations.locationFestivalId.equals(event.integrations.anPlanFestivalId))
            .and(tActivitiesLocations.locationDeleted.isNull())
        .select({
            value: tActivitiesLocations.locationId,
            label: tActivitiesLocations.locationDisplayName.valueWhenNull(
                tActivitiesLocations.locationName),
        })
        .orderBy('label', 'asc')
        .executeSelectMany();

    const columns: Column<ExtractRowModel<typeof programActivitiesDataSource>>[] = [
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
            field: 'title',
            headerName: 'Activity',
            editable: true,
            sortable: true,
            flex: 2,

            editorProps: {
                required: true,
            },

            template: 'component',
            templateProps: {
                component: ActivityTitleCell,
            },
        },
        {
            field: 'locationId',
            headerName: 'Location',
            editable: true,
            sortable: false,
            flex: 1,

            type: 'singleSelect',
            valueOptions: locations,

            editorProps: {
                required: true,
            },

            template: 'component',
            templateProps: {
                component: ActivityLocationCell,
            },
        },
        {
            field: 'helpRequested',
            headerName: '',
            align: 'center',
            headerAlign: 'center',
            description: 'Is volunteer help required?',
            editable: true,
            sortable: true,
            width: 50,

            type: 'boolean',

            template: 'component',
            templateProps: {
                headerComponent: HelpRequestedHeader,
                component: HelpRequestedCell,
            },
        },
        {
            field: 'visible',
            headerName: '',
            align: 'center',
            headerAlign: 'center',
            sortable: true,
            width: 50,

            template: 'component',
            templateProps: {
                headerComponent: VisibleHeader,
                component: VisibleCell,
            },
        },
    ];

    return (
        <>
            <Section icon={ <EventNoteIcon color="primary" /> } title="Activities"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: 'Program', href: `/admin/events/${event.slug}/program` },
                         { label: 'Activities' },
                     ]}>
                <SectionIntroduction>
                    Activities that are part of {event.shortName}, synchronized from AnPlan.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                <DataTable columns={columns} source={programActivitiesDataSource}
                           context={{ event: event.slug }} pageSize={50}
                           defaultSort={{ field: 'title', sort: 'asc' }}
                           frozenColumn="isFrozen" protectedColumn="isProtected"
                           search="prominent" subject="activity"
                           listViewProps={{
                               primaryField: 'title',
                               secondaryField: 'location',
                               startComponent: VisibleCell,
                               linkTemplate: './activities/{id}',
                           }} />
            </Section>
            <HistorySection event={event.slug} scope="activities" />
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Activities', 'Program', { event: 'event' });
