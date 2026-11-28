// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { EventTimeInput } from './Types';
import type { ProgramIndex } from './ProgramIndex';
import type { ShiftIndex } from './ShiftIndex';
import type { VolunteerIndex } from './VolunteerIndex';
import { EventStateAtTime } from './EventStateAtTime';

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
