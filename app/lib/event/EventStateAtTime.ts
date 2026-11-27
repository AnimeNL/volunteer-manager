// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { EventShiftAssignment, EventTimeslot, ShiftStateAtTime,
    VolunteerStateAtTime } from './Types';
import type { ProgramIndex, ProgramTimeslotFilter } from './ProgramIndex';
import type { ShiftAssignmentFilter, ShiftIndex } from './ShiftIndex';
import type { VolunteerFilter, VolunteerIndex } from './VolunteerIndex';

/**
 * Lightweight point-in-time view returned by `EventState.at(time)`. Binds a single epoch-ms
 * timestamp across all domain facets so callers can perform multiple operational lookups at the
 * same instant without threading `currentTime` through every call.
 */
export class EventStateAtTime {
    readonly #timeMs: number;
    readonly #program: ProgramIndex;
    readonly #shifts: ShiftIndex;
    readonly #volunteers: VolunteerIndex;

    constructor(
        timeMs: number,
        program: ProgramIndex,
        shifts: ShiftIndex,
        volunteers: VolunteerIndex)
    {
        this.#timeMs = timeMs;
        this.#program = program;
        this.#shifts = shifts;
        this.#volunteers = volunteers;
    }

    /**
     * Epoch-millisecond timestamp bound to this snapshot.
     */
    get timeMs(): number {
        return this.#timeMs;
    }

    /**
     * Returns the point-in-time and lateral state of `userId` (current segment, previous, next,
     * next shift, and return time if unavailable).
     */
    volunteer(userId: number): VolunteerStateAtTime | undefined {
        return this.#volunteers.getVolunteerStateAt(userId, this.#timeMs);
    }

    /**
     * Returns point-in-time states for all volunteers matching `filter`.
     */
    volunteers(filter?: VolunteerFilter): VolunteerStateAtTime[] {
        return this.#volunteers.getVolunteersStateAt(this.#timeMs, filter);
    }

    /**
     * Returns the handover snapshot (`previous`, `active`, `next`) for `shiftId`.
     */
    shift(shiftId: number): ShiftStateAtTime | undefined {
        return this.#shifts.getShiftStateAt(shiftId, this.#timeMs);
    }

    /**
     * Returns all shift assignments active at this instant, optionally narrowed by `filter`.
     */
    activeAssignments(filter?: ShiftAssignmentFilter): EventShiftAssignment[] {
        return this.#shifts.getActiveAssignmentsAt(this.#timeMs, filter);
    }

    /**
     * Returns all program timeslots active at this instant, optionally narrowed by `filter`.
     */
    activeTimeslots(filter?: ProgramTimeslotFilter): EventTimeslot[] {
        return this.#program.getActiveTimeslotsAt(this.#timeMs, filter);
    }

    /**
     * Returns the earliest program or shift transition boundary strictly after this instant.
     */
    nextTransition(): number | undefined {
        const programNext = this.#program.getNextTransitionAfter(this.#timeMs);
        const shiftNext = this.#shifts.getNextTransitionAfter(this.#timeMs);

        if (programNext === undefined)
            return shiftNext;
        if (shiftNext === undefined)
            return programNext;

        return Math.min(programNext, shiftNext);
    }
}
