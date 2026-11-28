// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { CachedEvent } from '@lib/cache';
import type { EventStateDataSource } from './EventStateLoader';
import type { EventStateInvalidationScope, EventStateSlice, EventTimeInput } from './Types';
import type { ProgramSlice } from './ProgramIndex';
import type { RawVolunteerRecord, TeamsSlice, VolunteersSlice } from './VolunteerIndex';
import type { ScheduleSlice, ShiftsSlice } from './ShiftIndex';
import { Cache, getEvent } from '@lib/cache';
import { EventStateAtTime } from './EventStateAtTime';
import { EventStateLoader } from './EventStateLoader';
import { ProgramIndex } from './ProgramIndex';
import { ShiftIndex } from './ShiftIndex';
import { VolunteerIndex } from './VolunteerIndex';

const kAllSlices: readonly EventStateSlice[] = [
    'program', 'teams', 'volunteers', 'shifts', 'schedule',
];

const kDefaultDataSource: EventStateDataSource = new EventStateLoader();

/**
 * Immutable, time-agnostic operational snapshot of an event, exposing cohesive domain facets
 * (`program`, `shifts`, `volunteers`) and a time-bound view (`at(time)`).
 */
export class EventState {
    readonly #eventId: number;
    readonly #eventSlug: string;
    readonly #festivalId?: number;
    readonly #timeZone: string;
    readonly #program: ProgramIndex;
    readonly #shifts: ShiftIndex;
    readonly #volunteers: VolunteerIndex;

    constructor(params: {
        eventId: number;
        eventSlug: string;
        festivalId?: number;
        timeZone: string;
        program: ProgramIndex;
        shifts: ShiftIndex;
        volunteers: VolunteerIndex;
    }) {
        this.#eventId = params.eventId;
        this.#eventSlug = params.eventSlug;
        this.#festivalId = params.festivalId;
        this.#timeZone = params.timeZone;
        this.#program = params.program;
        this.#shifts = params.shifts;
        this.#volunteers = params.volunteers;
    }

    get eventId(): number { return this.#eventId; }
    get eventSlug(): string { return this.#eventSlug; }
    get festivalId(): number | undefined { return this.#festivalId; }
    get timeZone(): string { return this.#timeZone; }

    get program(): ProgramIndex { return this.#program; }
    get shifts(): ShiftIndex { return this.#shifts; }
    get volunteers(): VolunteerIndex { return this.#volunteers; }

    /**
     * Returns a lightweight view binding `time` across all facets for point-in-time and lateral
     * operational queries.
     */
    at(time: EventTimeInput): EventStateAtTime {
        return new EventStateAtTime(
            time.epochMilliseconds, this.#program, this.#shifts, this.#volunteers);
    }

    /**
     * Approximate heap footprint in bytes reported to `@lib/cache` diagnostics.
     */
    estimateByteSize(): number {
        return (
            this.#program.estimateByteSize() +
            this.#shifts.estimateByteSize() +
            this.#volunteers.estimateByteSize()
        );
    }
}

/**
 * Mutable per-event cache container stored inside `@lib/cache` (`EventState`). Holds the latest
 * immutable slices, lazily dirty slice markers, and an in-flight rebuild promise for coalescing.
 */
class EventStateCacheEntry {
    festivalId?: number;
    boundaryHours?: { beforeStart: number; afterEnd: number };

    programSlice?: ProgramSlice;
    teamsSlice?: TeamsSlice;
    volunteersSlice?: VolunteersSlice;
    shiftsSlice?: ShiftsSlice;
    scheduleSlice?: ScheduleSlice;

    programIndex?: ProgramIndex;
    shiftIndex?: ShiftIndex;
    volunteerIndex?: VolunteerIndex;
    state?: EventState;

    readonly dirtySlices = new Set<EventStateSlice>(kAllSlices);
    readonly dirtyVolunteerIds = new Set<number>();
    inFlight?: Promise<EventState>;

    estimateByteSize(): number {
        return this.state?.estimateByteSize() ?? 0;
    }

    isClean(festivalId: number | undefined): boolean {
        return !!this.state &&
            this.festivalId === festivalId &&
            this.dirtySlices.size === 0 &&
            this.dirtyVolunteerIds.size === 0;
    }
}

/**
 * Ensures `entry` has up-to-date slices and derived indexes for `event`, reloading only dirty
 * slices and coalescing concurrent rebuilds.
 */
async function ensureFreshState(
    entry: EventStateCacheEntry,
    event: CachedEvent,
    dataSource: EventStateDataSource): Promise<EventState>
{
    const festivalId = event.integrations?.anPlanFestivalId;

    if (entry.isClean(festivalId))
        return entry.state!;

    if (entry.inFlight) {
        const result = await entry.inFlight;
        if (entry.isClean(festivalId))
            return result;
    }

    const rebuildPromise = rebuildDirtySlices(entry, event, dataSource);
    entry.inFlight = rebuildPromise;

    try {
        return await rebuildPromise;
    } finally {
        if (entry.inFlight === rebuildPromise)
            entry.inFlight = undefined;
    }
}

/**
 * Reloads only dirty slices (and/or individual dirty volunteers) from `dataSource` and reconstructs
 * only the facets whose inputs changed.
 */
async function rebuildDirtySlices(
    entry: EventStateCacheEntry,
    event: CachedEvent,
    dataSource: EventStateDataSource): Promise<EventState>
{
    const festivalId = event.integrations?.anPlanFestivalId;
    if (entry.festivalId !== festivalId) {
        entry.dirtySlices.add('program');
        entry.festivalId = festivalId;
    }

    const slicesToLoad = new Set<EventStateSlice>(entry.dirtySlices);
    const volunteerIdsToLoad = slicesToLoad.has('volunteers')
        ? []
        : [ ...entry.dirtyVolunteerIds ];

    entry.dirtySlices.clear();
    entry.dirtyVolunteerIds.clear();

    const needBoundaryHours = !entry.boundaryHours;

    const [
        boundaryHours,
        programSlice,
        teamsSlice,
        volunteersSlice,
        shiftsSlice,
        scheduleSlice,
        singleVolunteers,
    ] = await Promise.all([
        needBoundaryHours ? dataSource.loadBoundaryHours() : Promise.resolve(undefined),
        slicesToLoad.has('program')
            ? dataSource.loadProgram(festivalId)
            : Promise.resolve(undefined),
        slicesToLoad.has('teams') ? dataSource.loadTeams(event.id) : Promise.resolve(undefined),
        slicesToLoad.has('volunteers')
            ? dataSource.loadVolunteers(event.id)
            : Promise.resolve(undefined),
        slicesToLoad.has('shifts') ? dataSource.loadShifts(event.id) : Promise.resolve(undefined),
        slicesToLoad.has('schedule')
            ? dataSource.loadSchedule(event.id)
            : Promise.resolve(undefined),
        volunteerIdsToLoad.length > 0
            ? Promise.all(volunteerIdsToLoad.map(async userId => ({
                userId,
                record: await dataSource.loadSingleVolunteer(event.id, userId),
            })))
            : Promise.resolve([]),
    ]);

    if (boundaryHours)
        entry.boundaryHours = boundaryHours;
    if (programSlice)
        entry.programSlice = programSlice;
    if (teamsSlice)
        entry.teamsSlice = teamsSlice;
    if (volunteersSlice)
        entry.volunteersSlice = volunteersSlice;
    if (shiftsSlice)
        entry.shiftsSlice = shiftsSlice;
    if (scheduleSlice)
        entry.scheduleSlice = scheduleSlice;

    if (singleVolunteers.length > 0 && entry.volunteersSlice) {
        const updated = new Map<number, RawVolunteerRecord>(
            entry.volunteersSlice.volunteers.map(volunteer => [ volunteer.id, volunteer ]));

        for (const { userId, record } of singleVolunteers) {
            if (record)
                updated.set(userId, record);
            else
                updated.delete(userId);
        }

        entry.volunteersSlice = { volunteers: [ ...updated.values() ] };
    }

    const programChanged = slicesToLoad.has('program') || !entry.programIndex;
    const shiftsChanged =
        programChanged ||
        slicesToLoad.has('shifts') ||
        slicesToLoad.has('schedule') ||
        !entry.shiftIndex;
    const volunteersChanged =
        shiftsChanged ||
        slicesToLoad.has('teams') ||
        slicesToLoad.has('volunteers') ||
        singleVolunteers.length > 0 ||
        !entry.volunteerIndex;

    if (programChanged)
        entry.programIndex = new ProgramIndex(entry.programSlice!);

    if (shiftsChanged) {
        entry.shiftIndex = new ShiftIndex(
            entry.shiftsSlice!, entry.scheduleSlice!, entry.programIndex!);
    }

    if (volunteersChanged) {
        entry.volunteerIndex = new VolunteerIndex(
            entry.teamsSlice!,
            entry.volunteersSlice!,
            {
                startTime: event.startTime,
                endTime: event.endTime,
                timeZone: event.timeZone,
                boundaryHours: entry.boundaryHours!,
            },
            entry.programIndex!,
            entry.shiftIndex!);
    }

    entry.state = new EventState({
        eventId: event.id,
        eventSlug: event.slug,
        festivalId,
        timeZone: event.timeZone,
        program: entry.programIndex!,
        shifts: entry.shiftIndex!,
        volunteers: entry.volunteerIndex!,
    });

    return entry.state;
}

/**
 * Retrieves or lazily builds the cached `EventState` for `event` (accepting either an event ID,
 * event slug, or already-resolved `CachedEvent`). Returns `undefined` when the event does not
 * exist.
 */
export async function getEventState(
    event: CachedEvent | number | string,
    dataSource: EventStateDataSource = kDefaultDataSource): Promise<EventState | undefined>
{
    const cachedEvent = typeof event === 'object' ? event : await getEvent(event);
    if (!cachedEvent)
        return undefined;

    const cache = Cache.getInstance('EventState');
    let entry = cache.get<EventStateCacheEntry>(cachedEvent.id);

    if (!entry || !(entry instanceof EventStateCacheEntry)) {
        entry = new EventStateCacheEntry();
        cache.set(cachedEvent.id, entry);
    }

    return await ensureFreshState(entry, cachedEvent, dataSource);
}

/**
 * Invalidates cached `EventState` data for `event`.
 *
 * - Passing `undefined` drops the entire cached event entry.
 * - Passing one or more `EventStateSlice` names marks only those slices dirty for lazy reload.
 * - Passing `{ volunteer: userId }` marks only that volunteer's record for surgical reload.
 */
export async function invalidateEventState(
    event: number | string,
    scope?: EventStateInvalidationScope): Promise<void>
{
    let eventId: number;
    if (typeof event === 'number') {
        eventId = event;
    } else {
        const cachedEvent = await getEvent(event);
        if (!cachedEvent)
            return;

        eventId = cachedEvent.id;
    }

    const cache = Cache.getInstance('EventState');
    if (scope === undefined) {
        cache.delete(eventId);
        return;
    }

    const entry = cache.get<EventStateCacheEntry>(eventId);
    if (!entry || !(entry instanceof EventStateCacheEntry))
        return;

    if (typeof scope === 'string') {
        entry.dirtySlices.add(scope);
    } else if (Array.isArray(scope)) {
        for (const slice of scope)
            entry.dirtySlices.add(slice);
    } else if ('volunteer' in scope) {
        entry.dirtyVolunteerIds.add(scope.volunteer);
    }
}

/**
 * Marks the `program` slice dirty for every cached event linked to `festivalId`. Useful for
 * AnPlan synchronisation tasks and program admin tables that only know the festival ID.
 */
export function invalidateEventProgram(festivalId: number): void {
    const cache = Cache.getInstance('EventState');
    for (const [ , value ] of cache.entries()) {
        if (value instanceof EventStateCacheEntry && value.festivalId === festivalId)
            value.dirtySlices.add('program');
    }
}
