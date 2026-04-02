// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { ExecutableInsert } from 'ts-sql-query/expressions/insert';
import type { ExecutableUpdate } from 'ts-sql-query/expressions/update';
import symmetricDifference from 'set.prototype.symmetricdifference';
import { z } from 'zod/v4';

import type { Activity, Location, Timeslot } from '@lib/integrations/animecon';
import { ScheduleCache } from '@app/api/event/schedule/ScheduleCache';
import { TaskWithParams } from '../Task';
import { Temporal } from '@lib/Temporal';
import { createAnimeConClient } from '@lib/integrations/animecon';

import type { Mutation, MutationSeverity } from '@lib/database/Types';
import db, { tActivities, tActivitiesAreas, tActivitiesLocations, tActivitiesLogs,
    tActivitiesTimeslots, tEvents } from '@lib/database';

import { kActivityType, kMutation, kMutationSeverity } from '@lib/database/Types';

/**
 * Parameter scheme applying to the `ImportActivitiesTask`.
 */
const kImportActivitiesTaskParamScheme = z.object({
    /**
     * The specific festival Id to import activities for. Optional - will default to the nearest
     * upcoming festival. The task will be forced to be a one-off when set.
     */
    festivalId: z.number().optional(),

    /**
     * Whether mutation logs should be skipped when updating state in the database.
     */
    skipMutationLogs: z.boolean().optional(),
});

/**
 * Type definition of the parameter scheme, to be used by TypeScript.
 */
type TaskParams = z.infer<typeof kImportActivitiesTaskParamScheme>;

/**
 * What are the table definitions in which mutations can be made by this task?
 */
type MutationTableTypes =
    typeof tActivities | typeof tActivitiesAreas | typeof tActivitiesLocations |
    typeof tActivitiesTimeslots;

/**
 * Mutations are expressed as a set of queries (created by the `compareActivities` method) together
 * with a list of changes. The list deliberately is inspectable to enable testing.
 */
interface Mutations {
    created: ExecutableInsert<MutationTableTypes>[],
    updated: ExecutableUpdate<MutationTableTypes>[],
    deleted: ExecutableUpdate<MutationTableTypes>[],
    mutations: {
        activityId?: number;
        activityTimeslotId?: number;
        areaId?: number;
        locationId?: number;

        mutation: Mutation;
        mutatedFields?: string[];
        severity: MutationSeverity;
    }[];
}

/**
 * Type describing an individual stored area.
 */
export interface StoredArea {
    id: number;
    name: string;
}

/**
 * Alias `StoredArea` as `Area` - it's not an explicit type in the AnimeCon API, but rather values
 * contained within the `Location` type, and can thus not be represented by the usual types.
 */
type Area = StoredArea;

/**
 * Type describing an individual stored location.
 */
export interface StoredLocation {
    id: number;
    name: string;
    areaId: number;
}

/**
 * Type describing what has updated, if anything. The `fields` may be empty if no updates happened.
 */
type UpdateInfo = { fields: string[], severity: MutationSeverity; };

/**
 * Type describing the comparison for an individual field between the stored and current values.
 */
type UpdateField = { name: string; weight: number; } &
    (
        { comparison: 'boolean'; stored?: number; current?: boolean } |
        { comparison: 'number'; stored?: number; current?: number | null } |
        { comparison: 'string'; stored?: string; current?: string | null }
    );

/**
 * Severity levels that can be assigned to updates of individual fields. Used to determine the
 * severity of the overall mutation.
 */
const kUpdateSeverityLevel = {
    Low: 1,
    Moderate: 10,
    Important: 100,
};

/**
 * Converts the given `input`, which contains a timezone but not an explicit time zone ID, to an
 * instance of the Temporal.ZonedDateTime object.
 */
function toZonedDateTime(input: string): Temporal.ZonedDateTime {
    return Temporal.Instant.from(input).toZonedDateTimeISO('UTC');
}

/**
 * This task is responsible for importing activities from AnPlan into our own database. The active
 * festival IDs will be read from the database, upon which the right APIs will be invoked.
 */
export class ImportActivitiesTask extends TaskWithParams<TaskParams> {
    /**
     * The default interval for the import task, when no precise granularity can be decided upon.
     */
    static readonly kIntervalMaximum = /* 1 week= */ 7 * 86400 * 1000;

    /**
     * Intervals for the tasks based on the number of days until the event happens.
     */
    static readonly kIntervalConfiguration = [
        { maximumDays: /* 2 weeks= */   14, intervalMs: /* 15 minutes= */     900 * 1000 },
        { maximumDays: /* 4 weeks= */   28, intervalMs: /* 1 hour= */        3600 * 1000 },
        { maximumDays: /* 8 weeks= */   56, intervalMs: /* 6 hours= */   6 * 3600 * 1000 },
        { maximumDays: /* 12 weeks= */  84, intervalMs: /* 12 hours= */ 12 * 3600 * 1000 },
        { maximumDays: /* 24 weeks= */ 168, intervalMs: /* 24 hours= */ 24 * 3600 * 1000 },
    ];

    // ---------------------------------------------------------------------------------------------

    override validate(params: unknown): TaskParams | never {
        return kImportActivitiesTaskParamScheme.parse(params);
    }

    override async execute(params: TaskParams): Promise<boolean> {
        const upcomingEvent = await this.selectCurrentOrUpcomingEventWithFestivalId(params);
        if (!upcomingEvent || !upcomingEvent.festivalId) {
            this.log.info('Interval: No future events with a festivalId, using maximum interval.');
            this.setIntervalForRepeatingTask(ImportActivitiesTask.kIntervalMaximum);
            return true;
        }

        const { festivalEndTime, festivalId } = upcomingEvent;

        // The interval of this task depends on how close we are to the festival, and will only be
        // set when no explicit `festivalId` was passed in this task's `params`.
        if (!params.festivalId)
            this.updateTaskIntervalForFestivalDate(festivalEndTime);
        else
            this.setIntervalForRepeatingTask(/* no interval= */ undefined);

        // Fetch the activities from the AnimeCon API. This may throw an exception, in which case
        // the task execution will be considered unsuccessful -- which is fine.
        const currentActivities = await this.fetchActivitiesFromApi(festivalId);
        if (!currentActivities.length) {
            this.log.warning('No activities were returned by the API, skipping.');
            return true;
        }

        // Fetch the current festival status from the database. A diff will be ran against this
        // information to make sure that the information in our database is up-to-date.
        const storedActivities = await this.fetchActivitiesFromDatabase(festivalId);

        // Use a single database connection for all further operations...
        const dbInstance = db;

        // Run the comparison. This yields the created, updated and deleted activities, together
        // with a list of mutations that will independently be written to the database.
        const mutations = this.compareActivities(
            currentActivities, storedActivities, festivalId, dbInstance);

        this.log.info(`New program entries: ${mutations.created.length}`);
        this.log.info(`Updated program entries: ${mutations.updated.length}`);
        this.log.info(`Deleted program entries: ${mutations.deleted.length}`);

        // When there is at least one mutation, update the database with all mutations in a single
        // transaction. The mutation logs will be written to the database as well.
        if (mutations.mutations.length > 0) {
            this.log.info(`Total updates: ${mutations.mutations.length}`);

            await dbInstance.transaction(async () => {
                for (const createQuery of mutations.created)
                    await createQuery.executeInsert();
                for (const updateQuery of mutations.updated)
                    await updateQuery.executeUpdate();
                for (const deleteQuery of mutations.deleted)
                    await deleteQuery.executeUpdate();

                if (!params.skipMutationLogs) {
                    await dbInstance.insertInto(tActivitiesLogs)
                        .values(mutations.mutations.map(mutation => ({
                            festivalId: festivalId!,
                            activityId: mutation.activityId,
                            areaId: mutation.areaId,
                            timeslotId: mutation.activityTimeslotId,
                            locationId: mutation.locationId,
                            mutation: mutation.mutation,
                            mutationFields: mutation.mutatedFields?.join(', '),
                            mutationSeverity: mutation.severity,
                            mutationDate: dbInstance.currentZonedDateTime(),
                        })))
                        .executeInsert();
                }
            });
        }

        ScheduleCache.clear('program', festivalId);

        return true;
    }

    compareActivities(
        currentActivities: Activity[], storedActivities: StoredActivity[], festivalId: number,
        dbInstance?: typeof db)
    {
        dbInstance ??= db;
        const mutations: Mutations = {
            created: [],
            updated: [],
            deleted: [],
            mutations: [],
        };

        // -----------------------------------------------------------------------------------------
        // Step 1: Gather IDs of entities in the stored program
        // -----------------------------------------------------------------------------------------

        const seenActivitiesInStoredProgram = new Map<number, StoredActivity>();
        const seenAreasInStoredProgram = new Map<number, StoredArea>();
        const seenLocationsInStoredProgram = new Map<number, StoredLocation>();
        const seenTimeslotsInStoredProgram = new Map<number, StoredTimeslot>();

        const timeslotToStoredActivity = new Map<number, StoredActivity>();

        for (const storedActivity of storedActivities) {
            seenActivitiesInStoredProgram.set(storedActivity.id, storedActivity);
            for (const storedTimeslot of storedActivity.timeslots) {
                if (!storedTimeslot.id) {
                    this.log.warning(`Invalid timeslot found for activity=${storedActivity.id}`);
                    continue;
                }

                seenTimeslotsInStoredProgram.set(storedTimeslot.id, storedTimeslot);
                timeslotToStoredActivity.set(storedTimeslot.id, storedActivity);

                if (!!storedTimeslot.locationId) {
                    if (!seenLocationsInStoredProgram.has(storedTimeslot.locationId)) {
                        seenLocationsInStoredProgram.set(storedTimeslot.locationId, {
                            id: storedTimeslot.locationId,
                            name: storedTimeslot.locationName!,
                            areaId: storedTimeslot.locationAreaId!,
                        });
                    }
                }

                if (!!storedTimeslot.locationAreaId) {
                    if (!seenAreasInStoredProgram.has(storedTimeslot.locationAreaId)) {
                        seenAreasInStoredProgram.set(storedTimeslot.locationAreaId, {
                            id: storedTimeslot.locationAreaId,
                            name: storedTimeslot.locationAreaName ?? 'Unnamed area',
                        });
                    }
                }
            }
        }

        // -----------------------------------------------------------------------------------------
        // Step 2: Gather IDs of entities in the current program
        // -----------------------------------------------------------------------------------------

        const seenActivitiesInCurrentProgram = new Map<number, Activity>();
        const seenAreasInCurrentProgram = new Map<number, Area>();
        const seenLocationsInCurrentProgram = new Map<number, Location>();
        const seenTimeslotsInCurrentProgram = new Map<number, Timeslot>();

        const timeslotToCurrentActivity = new Map<number, Activity>();

        for (const currentActivity of currentActivities) {
            seenActivitiesInCurrentProgram.set(currentActivity.id, currentActivity);
            for (const currentTimeslot of currentActivity.timeslots) {
                seenTimeslotsInCurrentProgram.set(currentTimeslot.id, currentTimeslot);
                timeslotToCurrentActivity.set(currentTimeslot.id, currentActivity);

                if (!seenLocationsInCurrentProgram.has(currentTimeslot.location.id)) {
                    seenLocationsInCurrentProgram.set(
                        currentTimeslot.location.id, currentTimeslot.location);
                }

                if (!seenAreasInCurrentProgram.has(currentTimeslot.location.floorId)) {
                    seenAreasInCurrentProgram.set(currentTimeslot.location.floorId, {
                        id: currentTimeslot.location.floorId,
                        name: currentTimeslot.location.area ?? 'Unnamed area',
                    });
                }
            }
        }

        // -----------------------------------------------------------------------------------------
        // Step 3: Identify program additions and removals
        // -----------------------------------------------------------------------------------------

        const addedOrRemovedActivities = symmetricDifference(
            new Set([ ...seenActivitiesInStoredProgram.keys() ]),
            new Set([ ...seenActivitiesInCurrentProgram.keys() ]));

        for (const activityId of addedOrRemovedActivities) {
            if (!seenActivitiesInStoredProgram.has(activityId)) {
                const currentActivity = seenActivitiesInCurrentProgram.get(activityId);
                if (!currentActivity)
                    throw new Error('Unrecognised new entry in seenActivitiesInCurrentProgram');

                mutations.created.push(dbInstance.insertInto(tActivities)
                    .set({
                        activityId: currentActivity.id,
                        activityFestivalId: currentActivity.festivalId,
                        activityType: kActivityType.Program,
                        activityTitle: currentActivity.title,
                        activityDescription: currentActivity.description,
                        activityDescriptionWeb: currentActivity.webDescription,
                        activityRules: currentActivity.rules,
                        activityUrl: currentActivity.url,
                        activityPrice: currentActivity.price,
                        activityHelpNeeded: currentActivity.helpNeeded ? 1 : 0,
                        activityMaxVisitors: currentActivity.maxVisitors,
                        activityTypeAdultsOnly: currentActivity.activityType?.adultsOnly ? 1 : 0,
                        activityTypeCompetition: currentActivity.activityType?.competition ? 1 : 0,
                        activityTypeCosplay: currentActivity.activityType?.cosplay ? 1 : 0,
                        activityTypeEvent: currentActivity.activityType?.event ? 1 : 0,
                        activityTypeGameRoom: currentActivity.activityType?.gameRoom ? 1 : 0,
                        activityTypeVideo: currentActivity.activityType?.video ? 1 : 0,
                        activityVisible: currentActivity.visible ? 1 : 0,
                        activityVisibleReason: currentActivity.reasonInvisible,
                        activityCreated: dbInstance.currentZonedDateTime(),
                        activityUpdated: dbInstance.currentZonedDateTime(),
                        activityDeleted: null,
                    })
                    .onConflictDoUpdateSet({
                        // The activity had been deleted and has now been re-added. All information
                        // will be updated with a one-cycle delay, but already mark it as recovered.
                        activityUpdated: dbInstance.currentZonedDateTime(),
                        activityDeleted: null,
                    }));

                mutations.mutations.push({
                    activityId,
                    mutation: kMutation.Created,
                    severity: this.maybeEscalateMutationSeverity(
                        currentActivity, kMutationSeverity.Moderate),
                });

            } else {
                const storedActivity = seenActivitiesInStoredProgram.get(activityId);
                if (!storedActivity)
                    throw new Error('Unrecognised removed entry in seenActivitiesInStoredProgram');

                mutations.deleted.push(dbInstance.update(tActivities)
                    .set({
                        activityDeleted: dbInstance.currentZonedDateTime(),
                    })
                    .where(tActivities.activityId.equals(activityId)));

                mutations.mutations.push({
                    activityId,
                    mutation: kMutation.Deleted,
                    severity: this.maybeEscalateMutationSeverity(
                        storedActivity, kMutationSeverity.Moderate),
                });
            }
        }

        // -----------------------------------------------------------------------------------------

        const addedOrRemovedAreas = symmetricDifference(
            new Set([ ...seenAreasInStoredProgram.keys() ]),
            new Set([ ...seenAreasInCurrentProgram.keys() ]));

        for (const areaId of addedOrRemovedAreas) {
            if (!seenAreasInStoredProgram.has(areaId)) {
                const currentArea = seenAreasInCurrentProgram.get(areaId);
                if (!currentArea)
                    throw new Error('Unrecognised new entry in seenAreasInCurrentProgram');

                mutations.created.push(dbInstance.insertInto(tActivitiesAreas)
                    .set({
                        areaId: currentArea.id,
                        areaFestivalId: festivalId,
                        areaType: kActivityType.Program,
                        areaName: currentArea.name,
                        areaCreated: dbInstance.currentZonedDateTime(),
                        areaUpdated: dbInstance.currentZonedDateTime(),
                        areaDeleted: null,
                    })
                    .onConflictDoUpdateSet({
                        // The area had been deleted and has now been re-added. All information will
                        // be updated with a one-cycle delay, but already mark it as recovered.
                        areaUpdated: dbInstance.currentZonedDateTime(),
                        areaDeleted: null,
                    }));

                mutations.mutations.push({
                    areaId,
                    mutation: kMutation.Created,
                    severity: kMutationSeverity.Moderate,
                });

            } else {
                const storedArea = seenAreasInStoredProgram.get(areaId);
                if (!storedArea)
                    throw new Error('Unrecognised removed entry in seenAreasInStoredProgram');

                mutations.deleted.push(dbInstance.update(tActivitiesAreas)
                    .set({
                        areaDeleted: dbInstance.currentZonedDateTime(),
                    })
                    .where(tActivitiesAreas.areaId.equals(areaId)));

                mutations.mutations.push({
                    areaId,
                    mutation: kMutation.Deleted,
                    severity: kMutationSeverity.Moderate,
                });
            }
        }

        // -----------------------------------------------------------------------------------------

        const addedOrRemovedLocations = symmetricDifference(
            new Set([ ...seenLocationsInStoredProgram.keys() ]),
            new Set([ ...seenLocationsInCurrentProgram.keys() ]));

        for (const locationId of addedOrRemovedLocations) {
            if (!seenLocationsInStoredProgram.has(locationId)) {
                const currentLocation = seenLocationsInCurrentProgram.get(locationId);
                if (!currentLocation)
                    throw new Error('Unrecognised new entry in seenLocationsInCurrentProgram');

                mutations.created.push(dbInstance.insertInto(tActivitiesLocations)
                    .set({
                        locationId: currentLocation.id,
                        locationFestivalId: festivalId,
                        locationType: kActivityType.Program,
                        locationName: currentLocation.useName ?? currentLocation.name,
                        locationAreaId: currentLocation.floorId,
                        locationCreated: dbInstance.currentZonedDateTime(),
                        locationUpdated: dbInstance.currentZonedDateTime(),
                        locationDeleted: null,
                    })
                    .onConflictDoUpdateSet({
                        // The location had been deleted and has now been re-added. All information
                        // will be updated with a one-cycle delay, but already mark it as recovered.
                        locationUpdated: dbInstance.currentZonedDateTime(),
                        locationDeleted: null,
                    }));

                mutations.mutations.push({
                    locationId,
                    mutation: kMutation.Created,
                    severity: kMutationSeverity.Moderate,
                });

            } else {
                const storedLocation = seenLocationsInStoredProgram.get(locationId);
                if (!storedLocation)
                    throw new Error('Unrecognised removed entry in seenLocationsInStoredProgram');

                mutations.deleted.push(dbInstance.update(tActivitiesLocations)
                    .set({
                        locationDeleted: dbInstance.currentZonedDateTime(),
                    })
                    .where(tActivitiesLocations.locationId.equals(locationId)));

                mutations.mutations.push({
                    locationId,
                    mutation: kMutation.Deleted,
                    severity: kMutationSeverity.Moderate,
                });
            }
        }

        // -----------------------------------------------------------------------------------------

        const addedOrRemovedTimeslots = symmetricDifference(
            new Set([ ...seenTimeslotsInStoredProgram.keys() ]),
            new Set([ ...seenTimeslotsInCurrentProgram.keys() ]));

        for (const timeslotId of addedOrRemovedTimeslots) {
            if (!seenTimeslotsInStoredProgram.has(timeslotId)) {
                const currentActivity = timeslotToCurrentActivity.get(timeslotId);
                const currentTimeslot = seenTimeslotsInCurrentProgram.get(timeslotId);

                if (!currentActivity || !currentTimeslot)
                    throw new Error('Unrecognised new entry in seenTimeslotsInCurrentProgram');

                mutations.created.push(dbInstance.insertInto(tActivitiesTimeslots)
                    .set({
                        activityId: currentActivity.id,
                        timeslotId: currentTimeslot.id,
                        timeslotType: kActivityType.Program,
                        timeslotStartTime: toZonedDateTime(currentTimeslot.dateStartsAt),
                        timeslotEndTime: toZonedDateTime(currentTimeslot.dateEndsAt),
                        timeslotLocationId: currentTimeslot.location.id,
                        timeslotCreated: dbInstance.currentZonedDateTime(),
                        timeslotUpdated: dbInstance.currentZonedDateTime(),
                        timeslotDeleted: null,
                    })
                    .onConflictDoUpdateSet({
                        // The timeslot had been deleted and has now been re-added. All information
                        // will be updated with a one-cycle delay, but already mark it as recovered.
                        timeslotUpdated: dbInstance.currentZonedDateTime(),
                        timeslotDeleted: null,
                    }));

                mutations.mutations.push({
                    activityId: currentActivity.id,
                    activityTimeslotId: currentTimeslot.id,

                    mutation: kMutation.Created,
                    severity: this.maybeEscalateMutationSeverity(
                        currentActivity, kMutationSeverity.Moderate),
                });

            } else {
                const storedActivity = timeslotToStoredActivity.get(timeslotId);
                const storedTimeslot = seenTimeslotsInStoredProgram.get(timeslotId);

                if (!storedActivity || !storedTimeslot || !storedTimeslot.id)
                    throw new Error('Unrecognised removed entry in seenTimeslotsInStoredProgram');

                if (!!storedTimeslot.deleted)
                    continue;  // the `storedTimeslot` has already been marked as deleted

                mutations.deleted.push(dbInstance.update(tActivitiesTimeslots)
                    .set({
                        timeslotDeleted: dbInstance.currentZonedDateTime(),
                    })
                    .where(tActivitiesTimeslots.timeslotId.equals(storedTimeslot.id)));

                mutations.mutations.push({
                    activityId: storedActivity.id,
                    activityTimeslotId: storedTimeslot.id,

                    mutation: kMutation.Deleted,
                    severity: this.maybeEscalateMutationSeverity(
                        storedActivity, kMutationSeverity.Moderate),
                });
            }
        }

        // -----------------------------------------------------------------------------------------
        // Step 4: Identify updates to the program
        // -----------------------------------------------------------------------------------------

        for (const storedActivity of seenActivitiesInStoredProgram.values()) {
            const currentActivity = seenActivitiesInCurrentProgram.get(storedActivity.id);
            if (!currentActivity)
                continue;

            const update = this.compareActivity(storedActivity, currentActivity);
            if (!update.fields.length)
                continue;  // the `storedActivity` is still up-to-date

            mutations.updated.push(dbInstance.update(tActivities)
                .set({
                    activityTitle: currentActivity.title,
                    activityDescription: currentActivity.description,
                    activityDescriptionWeb: currentActivity.webDescription,
                    activityRules: currentActivity.rules,
                    activityUrl: currentActivity.url,
                    activityPrice: currentActivity.price,
                    activityHelpNeeded: currentActivity.helpNeeded ? 1 : 0,
                    activityMaxVisitors: currentActivity.maxVisitors,
                    activityTypeAdultsOnly: currentActivity.activityType?.adultsOnly ? 1 : 0,
                    activityTypeCompetition: currentActivity.activityType?.competition ? 1 : 0,
                    activityTypeCosplay: currentActivity.activityType?.cosplay ? 1 : 0,
                    activityTypeEvent: currentActivity.activityType?.event ? 1 : 0,
                    activityTypeGameRoom: currentActivity.activityType?.gameRoom ? 1 : 0,
                    activityTypeVideo: currentActivity.activityType?.video ? 1 : 0,
                    activityVisible: currentActivity.visible ? 1 : 0,
                    activityVisibleReason: currentActivity.reasonInvisible,
                    activityUpdated: dbInstance.currentZonedDateTime(),
                    activityDeleted: null,
                })
                .where(tActivities.activityId.equals(storedActivity.id))
                    .and(tActivities.activityFestivalId.equals(festivalId)));

            mutations.mutations.push({
                activityId: storedActivity.id,
                mutation: kMutation.Updated,
                mutatedFields: update.fields,
                severity: update.severity,
            });
        }

        for (const storedArea of seenAreasInStoredProgram.values()) {
            const currentArea = seenAreasInCurrentProgram.get(storedArea.id);
            if (!currentArea)
                continue;

            const update = this.compareArea(storedArea, currentArea);
            if (!update.fields.length)
                continue;  // the `storedArea` is still up-to-date

            mutations.updated.push(dbInstance.update(tActivitiesAreas)
                .set({
                    areaName: currentArea.name,
                    areaUpdated: dbInstance.currentZonedDateTime(),
                    areaDeleted: null,
                })
                .where(tActivitiesAreas.areaId.equals(storedArea.id))
                    .and(tActivitiesAreas.areaFestivalId.equals(festivalId)));

            mutations.mutations.push({
                areaId: storedArea.id,
                mutation: kMutation.Updated,
                mutatedFields: update.fields,
                severity: update.severity,
            });
        }

        for (const storedLocation of seenLocationsInStoredProgram.values()) {
            const currentLocation = seenLocationsInCurrentProgram.get(storedLocation.id);
            if (!currentLocation)
                continue;

            const update = this.compareLocation(storedLocation, currentLocation);
            if (!update.fields.length)
                continue;  // the `storedLocation` is still up-to-date

            mutations.updated.push(dbInstance.update(tActivitiesLocations)
                .set({
                    locationName: currentLocation.useName ?? currentLocation.name,
                    locationUpdated: dbInstance.currentZonedDateTime(),
                    locationDeleted: null,
                })
                .where(tActivitiesLocations.locationId.equals(storedLocation.id))
                    .and(tActivitiesLocations.locationFestivalId.equals(festivalId)));

            mutations.mutations.push({
                locationId: storedLocation.id,
                mutation: kMutation.Updated,
                mutatedFields: update.fields,
                severity: update.severity,
            });
        }

        for (const storedTimeslot of seenTimeslotsInStoredProgram.values()) {
            const currentTimeslot = seenTimeslotsInCurrentProgram.get(storedTimeslot.id!);
            if (!currentTimeslot)
                continue;

            const update = this.compareTimeslot(storedTimeslot, currentTimeslot);
            if (!update.fields.length)
                continue;  // the `storedTimeslot` is still up-to-date

            mutations.updated.push(dbInstance.update(tActivitiesTimeslots)
                .set({
                    timeslotStartTime: toZonedDateTime(currentTimeslot.dateStartsAt),
                    timeslotEndTime: toZonedDateTime(currentTimeslot.dateEndsAt),
                    timeslotLocationId: currentTimeslot.location.id,
                    timeslotUpdated: dbInstance.currentZonedDateTime(),
                    timeslotDeleted: null,
                })
                .where(tActivitiesTimeslots.timeslotId.equals(storedTimeslot.id!)));

            mutations.mutations.push({
                activityId: timeslotToCurrentActivity.get(currentTimeslot.id)?.id,
                activityTimeslotId: storedTimeslot.id,
                mutation: kMutation.Updated,
                mutatedFields: update.fields,
                severity: update.severity,
            });
        }

        return mutations;
    }

    // ---------------------------------------------------------------------------------------------

    compareActivity(storedActivity: StoredActivity, currentActivity: Activity): UpdateInfo {
        return this.compareFields([
            {
                name: 'title',
                weight: kUpdateSeverityLevel.Low,
                stored: storedActivity.title,
                current: currentActivity.title,
                comparison: 'string',
            },
            {
                name: 'description',
                weight: kUpdateSeverityLevel.Low,
                stored: storedActivity.description,
                current: currentActivity.description,
                comparison: 'string',
            },
            {
                name: 'description (web)',
                weight: kUpdateSeverityLevel.Low,
                stored: storedActivity.descriptionWeb,
                current: currentActivity.webDescription,
                comparison: 'string',
            },
            {
                name: 'rules',
                weight: kUpdateSeverityLevel.Moderate,
                stored: storedActivity.rules,
                current: currentActivity.rules,
                comparison: 'string',
            },
            {
                name: 'url',
                weight: kUpdateSeverityLevel.Low,
                stored: storedActivity.url,
                current: currentActivity.url,
                comparison: 'string',
            },
            {
                name: 'price',
                weight: kUpdateSeverityLevel.Low,
                stored: storedActivity.price,
                current: currentActivity.price,
                comparison: 'number',
            },
            {
                name: 'help needed flag',
                weight: kUpdateSeverityLevel.Important,
                stored: storedActivity.helpNeeded,
                current: currentActivity.helpNeeded,
                comparison: 'boolean',
            },
            {
                name: 'max visitors',
                weight: kUpdateSeverityLevel.Low,
                stored: storedActivity.maxVisitors,
                current: currentActivity.maxVisitors,
                comparison: 'number',
            },
            {
                name: '18+ flag',
                weight: kUpdateSeverityLevel.Moderate,
                stored: storedActivity.type.adultsOnly,
                current: currentActivity.activityType?.adultsOnly,
                comparison: 'boolean',
            },
            {
                name: 'competition flag',
                weight: kUpdateSeverityLevel.Low,
                stored: storedActivity.type.competition,
                current: currentActivity.activityType?.competition,
                comparison: 'boolean',
            },
            {
                name: 'cosplay flag',
                weight: kUpdateSeverityLevel.Low,
                stored: storedActivity.type.cosplay,
                current: currentActivity.activityType?.cosplay,
                comparison: 'boolean',
            },
            {
                name: 'event flag',
                weight: kUpdateSeverityLevel.Low,
                stored: storedActivity.type.event,
                current: currentActivity.activityType?.event,
                comparison: 'boolean',
            },
            {
                name: 'gameroom flag',
                weight: kUpdateSeverityLevel.Low,
                stored: storedActivity.type.gameRoom,
                current: currentActivity.activityType?.gameRoom,
                comparison: 'boolean',
            },
            {
                name: 'video flag',
                weight: kUpdateSeverityLevel.Low,
                stored: storedActivity.type.video,
                current: currentActivity.activityType?.video,
                comparison: 'boolean',
            },
            {
                name: 'visibility',
                weight: kUpdateSeverityLevel.Moderate,
                stored: storedActivity.visible,
                current: currentActivity.visible,
                comparison: 'boolean',
            },
            {
                name: 'visibility reason',
                weight: kUpdateSeverityLevel.Low,
                stored: storedActivity.visibleReason,
                current: currentActivity.reasonInvisible,
                comparison: 'string',
            },
        ]);
    }

    compareArea(storedArea: StoredArea, currentArea: Area): UpdateInfo {
        return this.compareFields([
            {
                name: 'name',
                weight: kUpdateSeverityLevel.Low,
                stored: storedArea.name,
                current: currentArea.name,
                comparison: 'string',
            }
        ]);
    }

    compareLocation(storedLocation: StoredLocation, currentLocation: Location): UpdateInfo {
        return this.compareFields([
            {
                name: 'name',
                weight: kUpdateSeverityLevel.Low,
                stored: storedLocation.name,
                current: currentLocation.useName ?? currentLocation.name,
                comparison: 'string',
            },
            {
                name: 'area',
                weight: kUpdateSeverityLevel.Low,
                stored: storedLocation.areaId,
                current: currentLocation.floorId,
                comparison: 'number',
            }
        ]);
    }

    compareTimeslot(storedTimeslot: StoredTimeslot, currentTimeslot: Timeslot): UpdateInfo {
        return this.compareFields([
            {
                name: 'start time',
                weight: kUpdateSeverityLevel.Moderate,
                stored: storedTimeslot.startTime!.toString(),
                current: toZonedDateTime(currentTimeslot.dateStartsAt).toString(),
                comparison: 'string',
            },
            {
                name: 'end time',
                weight: kUpdateSeverityLevel.Moderate,
                stored: storedTimeslot.endTime!.toString(),
                current: toZonedDateTime(currentTimeslot.dateEndsAt).toString(),
                comparison: 'string',
            },
            {
                name: 'location',
                weight: kUpdateSeverityLevel.Low,
                stored: storedTimeslot.locationId,
                current: currentTimeslot.location.id,
                comparison: 'number',
            },
        ]);
    }

    // ---------------------------------------------------------------------------------------------

    compareFields(fields: UpdateField[]): UpdateInfo {
        const update = {
            fields: [ /* no fields yet */ ] as string[],
            weight: 0,
        };

        for (const { name, weight, stored, current, comparison } of fields) {
            if (this.compareField(comparison, stored, current))
                continue;

            update.fields.push(name);
            update.weight += weight;
        }

        return {
            fields: update.fields,
            severity: this.updateWeightToSeverityLevel(update.weight),
        };
    }

    //compareField(comparison: 'boolean', storedField?: number, currentField: boolean): boolean;
    //compareField(comparison: 'number', storedField?: number, currentField?: number): boolean;
    //compareField(comparison: 'string', storedField?: string, currentField?: string): boolean;
    compareField(
        comparison: 'boolean' | 'number' | 'string', storedField: unknown, currentField: unknown)
        : boolean
    {
        if (comparison === 'boolean')
            return !!storedField === !!currentField;

        if (Number.isNaN(storedField) && Number.isNaN(currentField))
            return true;

        if (storedField === undefined || storedField === null) {
            if (currentField === undefined || currentField === null)
                return true;  // both are nullish

            return false;  // one is nullish, one has a value
        }

        if (currentField === undefined || currentField === null) {
            if (storedField === undefined || storedField === null)
                return true;  // both are nullish

            return false;  // one is nullish, one has a value
        }

        return storedField === currentField;
    }

    // ---------------------------------------------------------------------------------------------

    async fetchActivitiesFromApi(festivalId: number): Promise<Activity[]> {
        const client = await createAnimeConClient({
            revalidateCache: true,
        });

        return client.getActivities({ festivalId });
    }

    async fetchActivitiesFromDatabase(festivalId: number) {
        const dbInstance = db;

        const activitiesAreasJoin = tActivitiesAreas.forUseInLeftJoin();
        const activitiesLocationsJoin = tActivitiesLocations.forUseInLeftJoin();
        const activitiesTimeslotsJoin = tActivitiesTimeslots.forUseInLeftJoin();

        return await db.selectFrom(tActivities)
            .leftJoin(activitiesTimeslotsJoin)
                .on(activitiesTimeslotsJoin.activityId.equals(tActivities.activityId))
                .and(activitiesTimeslotsJoin.timeslotType.equals(kActivityType.Program))
            .leftJoin(activitiesLocationsJoin)
                .on(activitiesLocationsJoin.locationId.equals(
                    activitiesTimeslotsJoin.timeslotLocationId))
                .and(activitiesLocationsJoin.locationFestivalId.equals(
                    tActivities.activityFestivalId))
                .and(activitiesLocationsJoin.locationType.equals(kActivityType.Program))
            .leftJoin(activitiesAreasJoin)
                .on(activitiesAreasJoin.areaId.equals(activitiesLocationsJoin.locationAreaId))
                .and(activitiesAreasJoin.areaFestivalId.equals(
                    activitiesLocationsJoin.locationFestivalId))
                .and(activitiesAreasJoin.areaType.equals(kActivityType.Program))
            .where(tActivities.activityFestivalId.equals(festivalId))
                .and(tActivities.activityType.equals(kActivityType.Program))
                .and(tActivities.activityDeleted.isNull())
            .select({
                id: tActivities.activityId,

                title: tActivities.activityTitle,
                description: tActivities.activityDescription,
                descriptionWeb: tActivities.activityDescriptionWeb,
                rules: tActivities.activityRules,
                url: tActivities.activityUrl,
                price: tActivities.activityPrice,
                helpNeeded: tActivities.activityHelpNeeded,
                maxVisitors: tActivities.activityMaxVisitors,
                visible: tActivities.activityVisible,
                visibleReason: tActivities.activityVisibleReason,

                type: {
                    adultsOnly: tActivities.activityTypeAdultsOnly,
                    competition: tActivities.activityTypeCompetition,
                    cosplay: tActivities.activityTypeCosplay,
                    event: tActivities.activityTypeEvent,
                    gameRoom: tActivities.activityTypeGameRoom,
                    video: tActivities.activityTypeVideo,
                },

                timeslots: dbInstance.aggregateAsArray({
                    id: activitiesTimeslotsJoin.timeslotId,
                    deleted: activitiesTimeslotsJoin.timeslotDeleted,
                    startTime: activitiesTimeslotsJoin.timeslotStartTime,
                    endTime: activitiesTimeslotsJoin.timeslotEndTime,

                    locationId: activitiesTimeslotsJoin.timeslotLocationId,
                    locationName: activitiesLocationsJoin.locationName,
                    locationAreaId: activitiesLocationsJoin.locationAreaId,
                    locationAreaName: activitiesAreasJoin.areaName,
                }),
            })
            .groupBy(tActivities.activityId)
            .executeSelectMany();
    }

    // ---------------------------------------------------------------------------------------------

    updateWeightToSeverityLevel(weight: number): MutationSeverity {
        if (weight < kUpdateSeverityLevel.Moderate)
            return kMutationSeverity.Low;
        else if (weight < kUpdateSeverityLevel.Important)
            return kMutationSeverity.Moderate;
        else
            return kMutationSeverity.Important;
    }

    maybeEscalateMutationSeverity(
        activity: Activity | StoredActivity, baseSeverity: MutationSeverity): MutationSeverity
    {
        // The severity of mutations gets escalated when the "help needed" flag has been set on an
        // event, which signals that explicit action from our team is requested.
        if ('helpNeeded' in activity && !!activity.helpNeeded)
            return kMutationSeverity.Important;

        return baseSeverity;
    }

    updateTaskIntervalForFestivalDate(endTime: Temporal.ZonedDateTime): void {
        const differenceInDays = endTime.since(Temporal.Now.zonedDateTimeISO('UTC'), {
            largestUnit: 'days',
        }).days;

        if (differenceInDays < 0) {
            this.log.info('Interval: The event happened in the past, using maximum interval.');
            this.setIntervalForRepeatingTask(ImportActivitiesTask.kIntervalMaximum);
            return;
        }

        for (const { maximumDays, intervalMs } of ImportActivitiesTask.kIntervalConfiguration) {
            if (differenceInDays > maximumDays)
                continue;

            this.log.info(`Interval: Updating to ${intervalMs}ms (days=${differenceInDays})`);
            this.setIntervalForRepeatingTask(intervalMs);
            return;
        }

        this.log.info('Interval: The event is still very far out, using maximum interval.');
        this.setIntervalForRepeatingTask(ImportActivitiesTask.kIntervalMaximum);
    }

    private async selectCurrentOrUpcomingEventWithFestivalId(params: TaskParams)
        : Promise<{ festivalEndTime: Temporal.ZonedDateTime, festivalId?: number } | null>
    {
        const dbInstance = db;
        if (!!params.festivalId) {
            return dbInstance.selectFrom(tEvents)
                .select({
                    festivalEndTime: tEvents.eventEndTime,
                    festivalId: tEvents.eventFestivalId,
                })
                .limit(/* only the first (upcoming) event= */ 1)
                .where(tEvents.eventFestivalId.equals(params.festivalId))
                .executeSelectNoneOrOne();
        } else {
            return dbInstance.selectFrom(tEvents)
                .select({
                    festivalEndTime: tEvents.eventEndTime,
                    festivalId: tEvents.eventFestivalId,
                })
                .where(tEvents.eventFestivalId.isNotNull())
                    .and(tEvents.eventEndTime.greaterOrEquals(dbInstance.currentZonedDateTime()))
                    .and(tEvents.eventHidden.equals(/* false= */ 0))
                .limit(/* only the first (upcoming) event= */ 1)
                .executeSelectNoneOrOne();
        }
    }
}

/**
 * Interface describing the database representation of a stored activity on our end. Driven by the
 * implementation as opposed to being an explicit definition.
 */
export type StoredActivity =
    Awaited<ReturnType<ImportActivitiesTask['fetchActivitiesFromDatabase']>>[number];

/**
 * Type describing an individual stored timeslot.
 */
export type StoredTimeslot = StoredActivity['timeslots'][number];
