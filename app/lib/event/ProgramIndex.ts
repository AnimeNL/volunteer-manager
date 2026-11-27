// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { ActivityType } from '@lib/database/Types';
import type { EventActivity, EventArea, EventLocation, EventTimeslot } from './Types';
import { IntervalIndex } from './IntervalIndex';

import { kActivityType } from '@lib/database/Types';

/**
 * Raw program slice loaded from the database and passed to `ProgramIndex`.
 */
export interface ProgramSlice {
    readonly areas: readonly {
        readonly id: number;
        readonly name: string;
        readonly type: ActivityType;
    }[];
    readonly locations: readonly {
        readonly id: number;
        readonly areaId: number;
        readonly name: string;
        readonly type: ActivityType;
    }[];
    readonly activities: readonly {
        readonly id: number;
        readonly title: string;
        readonly type: ActivityType;
        readonly visible: boolean;
        readonly locationId?: number;
    }[];
    readonly timeslots: readonly {
        readonly id: number;
        readonly activityId: number;
        readonly locationId: number;
        readonly startMs: number;
        readonly endMs: number;
    }[];
}

/**
 * Optional filter criteria for program timeslot interval queries.
 */
export interface ProgramTimeslotFilter {
    readonly areaId?: number;
    readonly locationId?: number;
    readonly programOnly?: boolean;
    readonly includeHidden?: boolean;
}

/**
 * Immutable index of an event's festival program (areas, locations, activities, and timeslots),
 * optimised for O(1) ID lookups and O(log N + k) time-interval queries.
 */
export class ProgramIndex {
    readonly #areas = new Map<number, EventArea>();
    readonly #locations = new Map<number, EventLocation>();
    readonly #activities = new Map<number, EventActivity>();
    readonly #activityLocationFallback = new Map<number, number>();
    readonly #timeslots = new Map<number, EventTimeslot>();

    readonly #allAreasSorted: readonly EventArea[];
    readonly #programAreasSorted: readonly EventArea[];
    readonly #locationsByArea = new Map<number, readonly EventLocation[]>();
    readonly #programLocationsByArea = new Map<number, readonly EventLocation[]>();
    readonly #allLocationsSorted: readonly EventLocation[];
    readonly #allActivities: readonly EventActivity[];

    readonly #allTimeslots: IntervalIndex<EventTimeslot>;
    readonly #timeslotsByArea = new Map<number, IntervalIndex<EventTimeslot>>();
    readonly #timeslotsByLocation = new Map<number, IntervalIndex<EventTimeslot>>();
    readonly #timeslotsByActivity = new Map<number, readonly EventTimeslot[]>();

    constructor(slice: ProgramSlice) {
        const locationIdsByArea = new Map<number, number[]>();
        for (const area of slice.areas) {
            locationIdsByArea.set(area.id, []);
        }

        for (const rawLocation of slice.locations) {
            if (!locationIdsByArea.has(rawLocation.areaId))
                continue;

            const location: EventLocation = {
                id: rawLocation.id,
                areaId: rawLocation.areaId,
                name: rawLocation.name,
                type: rawLocation.type,
            };

            this.#locations.set(location.id, location);
            locationIdsByArea.get(location.areaId)!.push(location.id);
        }

        const rawActivitiesById = new Map<number, ProgramSlice['activities'][number]>();
        for (const activity of slice.activities) {
            rawActivitiesById.set(activity.id, activity);
            if (activity.locationId !== undefined)
                this.#activityLocationFallback.set(activity.id, activity.locationId);
        }

        const timeslotsByArea = new Map<number, EventTimeslot[]>();
        const timeslotsByLocation = new Map<number, EventTimeslot[]>();
        const timeslotsByActivity = new Map<number, EventTimeslot[]>();
        const activityLocationIds = new Map<number, Set<number>>();
        const programAreaIds = new Set<number>();
        const programLocationIds = new Set<number>();
        const allTimeslots: EventTimeslot[] = [];

        for (const rawTimeslot of slice.timeslots) {
            const rawActivity = rawActivitiesById.get(rawTimeslot.activityId);
            const location = this.#locations.get(rawTimeslot.locationId);
            if (!rawActivity || !location)
                continue;

            const timeslot: EventTimeslot = {
                id: rawTimeslot.id,
                activityId: rawTimeslot.activityId,
                locationId: location.id,
                areaId: location.areaId,
                startMs: rawTimeslot.startMs,
                endMs: rawTimeslot.endMs,
            };

            this.#timeslots.set(timeslot.id, timeslot);
            allTimeslots.push(timeslot);

            pushToMapArray(timeslotsByArea, timeslot.areaId, timeslot);
            pushToMapArray(timeslotsByLocation, timeslot.locationId, timeslot);
            pushToMapArray(timeslotsByActivity, timeslot.activityId, timeslot);

            let locationSet = activityLocationIds.get(timeslot.activityId);
            if (!locationSet) {
                locationSet = new Set();
                activityLocationIds.set(timeslot.activityId, locationSet);
            }
            locationSet.add(timeslot.locationId);

            if (rawActivity.type === kActivityType.Program) {
                programAreaIds.add(timeslot.areaId);
                programLocationIds.add(timeslot.locationId);
            }
        }

        for (const [ areaId, list ] of timeslotsByArea)
            this.#timeslotsByArea.set(areaId, new IntervalIndex(list));

        for (const [ locationId, list ] of timeslotsByLocation)
            this.#timeslotsByLocation.set(locationId, new IntervalIndex(list));

        for (const [ activityId, list ] of timeslotsByActivity) {
            list.sort((lhs, rhs) => lhs.startMs - rhs.startMs || lhs.endMs - rhs.endMs);
            this.#timeslotsByActivity.set(activityId, list);
        }

        const activities: EventActivity[] = [];
        for (const rawActivity of slice.activities) {
            const slots = this.#timeslotsByActivity.get(rawActivity.id) ?? [];
            const locIds = [ ...(activityLocationIds.get(rawActivity.id) ?? []) ];
            if (!locIds.length && rawActivity.locationId !== undefined)
                locIds.push(rawActivity.locationId);

            const activity: EventActivity = {
                id: rawActivity.id,
                title: rawActivity.title,
                type: rawActivity.type,
                visible: rawActivity.visible,
                locationIds: locIds,
                timeslotIds: slots.map(slot => slot.id),
            };

            this.#activities.set(activity.id, activity);
            activities.push(activity);
        }

        const areas: EventArea[] = [];
        for (const rawArea of slice.areas) {
            const locations = (locationIdsByArea.get(rawArea.id) ?? [])
                .map(id => this.#locations.get(id)!)
                .sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));

            this.#locationsByArea.set(rawArea.id, locations);
            this.#programLocationsByArea.set(
                rawArea.id, locations.filter(location => programLocationIds.has(location.id)));

            const area: EventArea = {
                id: rawArea.id,
                name: rawArea.name,
                type: rawArea.type,
                locationIds: locations.map(location => location.id),
            };

            this.#areas.set(area.id, area);
            areas.push(area);
        }

        areas.sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));
        this.#allAreasSorted = areas;
        this.#programAreasSorted = areas.filter(area => programAreaIds.has(area.id));
        this.#allLocationsSorted = [ ...this.#locations.values() ]
            .sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));
        this.#allActivities = activities;
        this.#allTimeslots = new IntervalIndex(allTimeslots);
    }

    getArea(areaId: number): EventArea | undefined {
        return this.#areas.get(areaId);
    }

    getAreas(options?: { programOnly?: boolean }): readonly EventArea[] {
        return options?.programOnly ? this.#programAreasSorted : this.#allAreasSorted;
    }

    getLocation(locationId: number): EventLocation | undefined {
        return this.#locations.get(locationId);
    }

    getLocations(
        areaId?: number, options?: { programOnly?: boolean }): readonly EventLocation[]
    {
        if (areaId !== undefined) {
            return options?.programOnly
                ? (this.#programLocationsByArea.get(areaId) ?? [])
                : (this.#locationsByArea.get(areaId) ?? []);
        }

        if (!options?.programOnly)
            return this.#allLocationsSorted;

        return this.#allLocationsSorted.filter(location =>
            (this.#programLocationsByArea.get(location.areaId) ?? []).some(
                entry => entry.id === location.id));
    }

    getActivity(activityId: number): EventActivity | undefined {
        return this.#activities.get(activityId);
    }

    /**
     * Resolves a primary location ID for `activityId` using its internal `activityLocationId` or
     * its first scheduled timeslot location. Used by `ShiftIndex` to resolve shift locations.
     */
    getActivityLocationId(activityId: number): number | undefined {
        const direct = this.#activityLocationFallback.get(activityId);
        if (direct !== undefined)
            return direct;

        return this.#activities.get(activityId)?.locationIds[0];
    }

    getActivities(options?: {
        programOnly?: boolean;
        includeHidden?: boolean;
    }): readonly EventActivity[] {
        const programOnly = options?.programOnly ?? false;
        const includeHidden = options?.includeHidden ?? true;
        if (!programOnly && includeHidden)
            return this.#allActivities;

        return this.#allActivities.filter(activity => {
            if (programOnly && activity.type !== kActivityType.Program)
                return false;
            if (!includeHidden && !activity.visible)
                return false;

            return true;
        });
    }

    getTimeslot(timeslotId: number): EventTimeslot | undefined {
        return this.#timeslots.get(timeslotId);
    }

    getTimeslotsForArea(
        areaId: number, options?: { programOnly?: boolean }): readonly EventTimeslot[]
    {
        const all = this.#timeslotsByArea.get(areaId)?.all ?? [];
        if (!options?.programOnly)
            return all;

        return all.filter(slot =>
            this.#activities.get(slot.activityId)?.type === kActivityType.Program);
    }

    getTimeslotsForLocation(
        locationId: number, options?: { programOnly?: boolean }): readonly EventTimeslot[]
    {
        const all = this.#timeslotsByLocation.get(locationId)?.all ?? [];
        if (!options?.programOnly)
            return all;

        return all.filter(slot =>
            this.#activities.get(slot.activityId)?.type === kActivityType.Program);
    }

    getTimeslotsForActivity(activityId: number): readonly EventTimeslot[] {
        return this.#timeslotsByActivity.get(activityId) ?? [];
    }

    /**
     * Returns all timeslots active at `timeMs`, optionally narrowed by area, location, activity
     * type, or visibility.
     */
    getActiveTimeslotsAt(timeMs: number, filter?: ProgramTimeslotFilter): EventTimeslot[] {
        const index = this.selectTimeslotIndex(filter);
        if (!index)
            return [];

        return this.filterTimeslots(index.at(timeMs), filter);
    }

    /**
     * Returns all timeslots overlapping `[startMs, endMs)`, optionally narrowed by `filter`.
     */
    getOverlappingTimeslots(
        startMs: number, endMs: number, filter?: ProgramTimeslotFilter): EventTimeslot[]
    {
        const index = this.selectTimeslotIndex(filter);
        if (!index)
            return [];

        return this.filterTimeslots(index.overlapping(startMs, endMs), filter);
    }

    /**
     * Returns the earliest program timeslot start or end boundary strictly greater than `timeMs`.
     */
    getNextTransitionAfter(timeMs: number): number | undefined {
        return this.#allTimeslots.nextTransitionAfter(timeMs);
    }

    /**
     * Approximate heap footprint in bytes for cache diagnostics reporting.
     */
    estimateByteSize(): number {
        return (
            this.#areas.size * 128 +
            this.#locations.size * 128 +
            this.#activities.size * 256 +
            this.#timeslots.size * 160
        );
    }

    private selectTimeslotIndex(
        filter?: ProgramTimeslotFilter): IntervalIndex<EventTimeslot> | undefined
    {
        if (filter?.locationId !== undefined)
            return this.#timeslotsByLocation.get(filter.locationId);
        if (filter?.areaId !== undefined)
            return this.#timeslotsByArea.get(filter.areaId);

        return this.#allTimeslots;
    }

    private filterTimeslots(
        timeslots: EventTimeslot[], filter?: ProgramTimeslotFilter): EventTimeslot[]
    {
        const programOnly = filter?.programOnly ?? false;
        const includeHidden = filter?.includeHidden ?? true;
        const areaId = filter?.locationId !== undefined ? filter.areaId : undefined;

        if (!programOnly && includeHidden && areaId === undefined)
            return timeslots;

        return timeslots.filter(slot => {
            if (areaId !== undefined && slot.areaId !== areaId)
                return false;

            const activity = this.#activities.get(slot.activityId);
            if (!activity)
                return false;
            if (programOnly && activity.type !== kActivityType.Program)
                return false;
            if (!includeHidden && !activity.visible)
                return false;

            return true;
        });
    }
}

function pushToMapArray<K, V>(map: Map<K, V[]>, key: K, value: V): void {
    const existing = map.get(key);
    if (existing)
        existing.push(value);
    else
        map.set(key, [ value ]);
}
