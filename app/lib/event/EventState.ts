// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { CachedEvent } from '@lib/cache';
import type { EventStateDataSource } from './EventStateLoader';
import type { EventStateInvalidationScope, EventTimeInput } from './Types';
import type { ProgramIndex } from './ProgramIndex';
import type { ShiftIndex } from './ShiftIndex';
import type { VolunteerIndex } from './VolunteerIndex';
import { Cache, getEvent } from '@lib/cache';
import { EventStateAtTime } from './EventStateAtTime';
import { EventStateCacheEntry } from './EventStateCacheEntry';
import { EventStateLoader } from './EventStateLoader';

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
    let entry = cache.get(cachedEvent.id);

    if (!entry) {
        entry = new EventStateCacheEntry();
        cache.set(cachedEvent.id, entry);
    }

    return await entry.ensureFresh(cachedEvent, dataSource);
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

    const entry = cache.get(eventId);
    entry?.invalidate(scope);
}

/**
 * Marks the `program` slice dirty for every cached event linked to `festivalId`. Useful for
 * AnPlan synchronisation tasks and program admin tables that only know the festival ID.
 */
export function invalidateEventProgram(festivalId: number): void {
    const cache = Cache.getInstance('EventState');
    for (const [ , entry ] of cache.entries()) {
        if (entry?.festivalId === festivalId)
            entry.invalidate('program');
    }
}
