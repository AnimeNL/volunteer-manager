// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { CachedEvent } from '@lib/cache';
import type { EventStateDataSource } from './EventStateLoader';
import type { EventStateSlice } from './Types';
import type { ProgramSlice } from './ProgramIndex';
import type { RawVolunteerRecord, TeamsSlice, VolunteersSlice } from './VolunteerIndex';
import type { ScheduleSlice, ShiftsSlice } from './ShiftIndex';
import { EventState } from './EventState';
import { ProgramIndex } from './ProgramIndex';
import { ShiftIndex } from './ShiftIndex';
import { VolunteerIndex } from './VolunteerIndex';

const kAllSlices: readonly EventStateSlice[] = [
    'program', 'teams', 'volunteers', 'shifts', 'schedule',
];

/**
 * Mutable per-event cache container stored inside `@lib/cache` (`EventState`). Owns the latest
 * immutable slices, lazily dirty slice markers, and an in-flight rebuild promise for coalescing
 * concurrent reloads.
 */
export class EventStateCacheEntry {
    #festivalId?: number;
    #boundaryHours?: { beforeStart: number; afterEnd: number };

    #programSlice?: ProgramSlice;
    #teamsSlice?: TeamsSlice;
    #volunteersSlice?: VolunteersSlice;
    #shiftsSlice?: ShiftsSlice;
    #scheduleSlice?: ScheduleSlice;

    #programIndex?: ProgramIndex;
    #shiftIndex?: ShiftIndex;
    #volunteerIndex?: VolunteerIndex;
    #state?: EventState;

    readonly #dirtySlices = new Set<EventStateSlice>(kAllSlices);
    readonly #dirtyVolunteerIds = new Set<number>();
    #inFlight?: Promise<EventState>;

    /**
     * AnPlan festival ID associated with the most recently loaded program slice, if any.
     */
    get festivalId(): number | undefined {
        return this.#festivalId;
    }

    /**
     * Approximate heap footprint in bytes reported to `@lib/cache` diagnostics.
     */
    estimateByteSize(): number {
        return this.#state?.estimateByteSize() ?? 0;
    }

    /**
     * Marks the requested `slice` dirty so the next `ensureFresh()` call reloads only affected data.
     */
    markDirty(slice: EventStateSlice): void {
        this.#dirtySlices.add(slice);
    }

    /**
     * Marks a single volunteer record dirty for surgical reload on the next `ensureFresh()` call.
     */
    markVolunteerDirty(userId: number): void {
        this.#dirtyVolunteerIds.add(userId);
    }

    /**
     * Clears cached availability boundary hours so `VolunteerIndex` is rebuilt on the next read
     * without reloading unrelated database slices.
     */
    resetBoundaryHours(): void {
        this.#boundaryHours = undefined;
    }

    /**
     * Ensures this entry has up-to-date slices and derived indexes for `event`, reloading only
     * dirty slices and coalescing concurrent rebuilds.
     */
    async ensureFresh(
        event: CachedEvent, dataSource: EventStateDataSource): Promise<EventState>
    {
        const festivalId = event.integrations?.anPlanFestivalId;

        if (this.#isClean(festivalId))
            return this.#state!;

        if (this.#inFlight) {
            const result = await this.#inFlight;
            if (this.#isClean(festivalId))
                return result;
        }

        const rebuildPromise = this.#rebuildDirtySlices(event, dataSource);
        this.#inFlight = rebuildPromise;

        try {
            return await rebuildPromise;
        } finally {
            if (this.#inFlight === rebuildPromise)
                this.#inFlight = undefined;
        }
    }

    #isClean(festivalId: number | undefined): boolean {
        return !!this.#state &&
            !!this.#boundaryHours &&
            this.#festivalId === festivalId &&
            this.#dirtySlices.size === 0 &&
            this.#dirtyVolunteerIds.size === 0;
    }

    async #rebuildDirtySlices(
        event: CachedEvent, dataSource: EventStateDataSource): Promise<EventState>
    {
        const festivalId = event.integrations?.anPlanFestivalId;
        if (this.#festivalId !== festivalId) {
            this.#dirtySlices.add('program');
            this.#festivalId = festivalId;
        }

        const slicesToLoad = new Set<EventStateSlice>(this.#dirtySlices);
        const volunteerIdsToLoad = slicesToLoad.has('volunteers')
            ? []
            : [ ...this.#dirtyVolunteerIds ];

        this.#dirtySlices.clear();
        this.#dirtyVolunteerIds.clear();

        const needBoundaryHours = !this.#boundaryHours;

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
            slicesToLoad.has('shifts')
                ? dataSource.loadShifts(event.id)
                : Promise.resolve(undefined),
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
            this.#boundaryHours = boundaryHours;
        if (programSlice)
            this.#programSlice = programSlice;
        if (teamsSlice)
            this.#teamsSlice = teamsSlice;
        if (volunteersSlice)
            this.#volunteersSlice = volunteersSlice;
        if (shiftsSlice)
            this.#shiftsSlice = shiftsSlice;
        if (scheduleSlice)
            this.#scheduleSlice = scheduleSlice;

        if (singleVolunteers.length > 0)
            this.#mergeSingleVolunteers(singleVolunteers);

        this.#rebuildDirtyIndexes(
            event, festivalId, slicesToLoad, singleVolunteers.length > 0, !!boundaryHours);
        return this.#state!;
    }

    #mergeSingleVolunteers(
        updates: readonly { userId: number; record: RawVolunteerRecord | undefined }[]): void
    {
        if (!this.#volunteersSlice)
            return;

        const updated = new Map<number, RawVolunteerRecord>(
            this.#volunteersSlice.volunteers.map(volunteer => [ volunteer.id, volunteer ]));

        for (const { userId, record } of updates) {
            if (record)
                updated.set(userId, record);
            else
                updated.delete(userId);
        }

        this.#volunteersSlice = { volunteers: [ ...updated.values() ] };
    }

    #rebuildDirtyIndexes(
        event: CachedEvent,
        festivalId: number | undefined,
        slicesToLoad: ReadonlySet<EventStateSlice>,
        hasSingleVolunteerUpdates: boolean,
        boundaryHoursChanged: boolean): void
    {
        const programChanged = slicesToLoad.has('program') || !this.#programIndex;
        const shiftsChanged =
            programChanged ||
            slicesToLoad.has('shifts') ||
            slicesToLoad.has('schedule') ||
            !this.#shiftIndex;
        const volunteersChanged =
            shiftsChanged ||
            boundaryHoursChanged ||
            slicesToLoad.has('teams') ||
            slicesToLoad.has('volunteers') ||
            hasSingleVolunteerUpdates ||
            !this.#volunteerIndex;

        if (programChanged)
            this.#programIndex = new ProgramIndex(this.#programSlice!);

        if (shiftsChanged) {
            this.#shiftIndex = new ShiftIndex(
                this.#shiftsSlice!, this.#scheduleSlice!, this.#programIndex!);
        }

        if (volunteersChanged) {
            this.#volunteerIndex = new VolunteerIndex(
                this.#teamsSlice!,
                this.#volunteersSlice!,
                {
                    startTime: event.startTime,
                    endTime: event.endTime,
                    timeZone: event.timeZone,
                    boundaryHours: this.#boundaryHours!,
                },
                this.#programIndex!,
                this.#shiftIndex!);
        }

        this.#state = new EventState({
            eventId: event.id,
            eventSlug: event.slug,
            festivalId,
            timeZone: event.timeZone,
            program: this.#programIndex!,
            shifts: this.#shiftIndex!,
            volunteers: this.#volunteerIndex!,
        });
    }
}
