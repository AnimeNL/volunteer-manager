// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { EventShift, EventShiftAssignment, ShiftStateAtTime } from './Types';
import type { ProgramIndex } from './ProgramIndex';
import { IntervalIndex } from './IntervalIndex';

/**
 * Raw shift definitions loaded from `tShifts` + `tShiftsCategories`.
 */
export interface ShiftsSlice {
    readonly shifts: readonly {
        readonly id: number;
        readonly teamId: number;
        readonly categoryId: number;
        readonly categoryName: string;
        readonly countsContribution: boolean;
        readonly name: string;
        readonly description?: string;
        readonly colour?: string;
        readonly excitement: number;
        readonly activityId?: number;
        readonly locationId?: number;
    }[];
}

/**
 * Raw scheduled shift rows loaded from `tSchedule`.
 */
export interface ScheduleSlice {
    readonly assignments: readonly {
        readonly id: number;
        readonly shiftId: number;
        readonly userId: number;
        readonly startMs: number;
        readonly endMs: number;
    }[];
}

/**
 * Optional filter criteria for shift assignment interval queries.
 */
export interface ShiftAssignmentFilter {
    readonly shiftId?: number;
    readonly teamId?: number;
    readonly activityId?: number;
    readonly locationId?: number;
    readonly areaId?: number;
}

/**
 * Immutable index of an event's shifts and scheduled shift assignments, optimised for O(1)
 * lookups by ID, O(log N + k) time-interval queries, and shift handover/relief inspection.
 */
export class ShiftIndex {
    readonly #shifts = new Map<number, EventShift>();
    readonly #allShifts: readonly EventShift[];
    readonly #shiftsByTeam = new Map<number, readonly EventShift[]>();
    readonly #shiftsByActivity = new Map<number, readonly EventShift[]>();
    readonly #shiftsByLocation = new Map<number, readonly EventShift[]>();

    readonly #assignments = new Map<number, EventShiftAssignment>();
    readonly #allAssignments: IntervalIndex<EventShiftAssignment>;
    readonly #assignmentsByShift = new Map<number, IntervalIndex<EventShiftAssignment>>();
    readonly #assignmentsByUser = new Map<number, readonly EventShiftAssignment[]>();
    readonly #assignmentsByActivity = new Map<number, IntervalIndex<EventShiftAssignment>>();
    readonly #assignmentsByLocation = new Map<number, IntervalIndex<EventShiftAssignment>>();
    readonly #assignmentsByArea = new Map<number, IntervalIndex<EventShiftAssignment>>();

    constructor(
        shiftsSlice: ShiftsSlice,
        scheduleSlice: ScheduleSlice,
        program: ProgramIndex)
    {
        this.#allShifts = this.#indexShifts(shiftsSlice, program);
        this.#allAssignments = this.#indexAssignments(scheduleSlice);
    }

    getShift(shiftId: number): EventShift | undefined {
        return this.#shifts.get(shiftId);
    }

    getShifts(filter?: {
        teamId?: number;
        activityId?: number;
        locationId?: number;
    }): readonly EventShift[] {
        if (!filter)
            return this.#allShifts;

        let base: readonly EventShift[];
        if (filter.activityId !== undefined)
            base = this.#shiftsByActivity.get(filter.activityId) ?? [];
        else if (filter.locationId !== undefined)
            base = this.#shiftsByLocation.get(filter.locationId) ?? [];
        else if (filter.teamId !== undefined)
            base = this.#shiftsByTeam.get(filter.teamId) ?? [];
        else
            return this.#allShifts;

        return base.filter(shift => {
            if (filter.teamId !== undefined && shift.teamId !== filter.teamId)
                return false;
            if (filter.activityId !== undefined && shift.activityId !== filter.activityId)
                return false;
            if (filter.locationId !== undefined && shift.locationId !== filter.locationId)
                return false;

            return true;
        });
    }

    getAssignment(scheduleId: number): EventShiftAssignment | undefined {
        return this.#assignments.get(scheduleId);
    }

    getAllAssignments(): readonly EventShiftAssignment[] {
        return this.#allAssignments.all;
    }

    getAssignmentsForShift(shiftId: number): readonly EventShiftAssignment[] {
        return this.#assignmentsByShift.get(shiftId)?.all ?? [];
    }

    getAssignmentsForVolunteer(userId: number): readonly EventShiftAssignment[] {
        return this.#assignmentsByUser.get(userId) ?? [];
    }

    /**
     * Returns the earliest scheduled assignment for `userId` starting strictly after `timeMs`, or
     * `undefined` when no upcoming assignment exists.
     */
    getNextAssignmentForVolunteer(
        userId: number, timeMs: number): EventShiftAssignment | undefined
    {
        const assignments = this.#assignmentsByUser.get(userId);
        if (!assignments)
            return undefined;

        for (const assignment of assignments) {
            if (assignment.startMs > timeMs)
                return assignment;
        }

        return undefined;
    }

    getAssignmentsForActivity(activityId: number): readonly EventShiftAssignment[] {
        return this.#assignmentsByActivity.get(activityId)?.all ?? [];
    }

    getAssignmentsForLocation(locationId: number): readonly EventShiftAssignment[] {
        return this.#assignmentsByLocation.get(locationId)?.all ?? [];
    }

    /**
     * Returns all shift assignments active at `timeMs`, optionally narrowed by `filter`.
     */
    getActiveAssignmentsAt(
        timeMs: number, filter?: ShiftAssignmentFilter): EventShiftAssignment[]
    {
        const index = this.#selectAssignmentIndex(filter);
        if (!index)
            return [];

        return this.#filterAssignments(index.at(timeMs), filter);
    }

    /**
     * Returns all shift assignments overlapping `[startMs, endMs)`, optionally narrowed by
     * `filter`.
     */
    getOverlappingAssignments(
        startMs: number, endMs: number, filter?: ShiftAssignmentFilter): EventShiftAssignment[]
    {
        const index = this.#selectAssignmentIndex(filter);
        if (!index)
            return [];

        return this.#filterAssignments(index.overlapping(startMs, endMs), filter);
    }

    /**
     * Returns the shift-level handover snapshot at `timeMs`: currently active assignments, the
     * most recently concluded assignment wave (`previous`), and the soonest upcoming wave (`next`).
     */
    getShiftStateAt(shiftId: number, timeMs: number): ShiftStateAtTime | undefined {
        const shift = this.#shifts.get(shiftId);
        if (!shift)
            return undefined;

        const index = this.#assignmentsByShift.get(shiftId);
        if (!index)
            return { shift, active: [], previous: [], next: [] };

        const active = index.at(timeMs);
        const all = index.all;

        let latestPastEndMs = -Infinity;
        let earliestFutureStartMs = Infinity;

        for (const assignment of all) {
            if (assignment.endMs <= timeMs && assignment.endMs > latestPastEndMs)
                latestPastEndMs = assignment.endMs;
            if (assignment.startMs > timeMs && assignment.startMs < earliestFutureStartMs)
                earliestFutureStartMs = assignment.startMs;
        }

        const previous = latestPastEndMs !== -Infinity
            ? all.filter(assignment => assignment.endMs === latestPastEndMs)
            : [];
        const next = earliestFutureStartMs !== Infinity
            ? all.filter(assignment => assignment.startMs === earliestFutureStartMs)
            : [];

        return { shift, active, previous, next };
    }

    /**
     * Returns the earliest shift assignment start or end boundary strictly greater than `timeMs`.
     */
    getNextTransitionAfter(timeMs: number): number | undefined {
        return this.#allAssignments.nextTransitionAfter(timeMs);
    }

    /**
     * Approximate heap footprint in bytes for cache diagnostics reporting.
     */
    estimateByteSize(): number {
        return this.#shifts.size * 320 + this.#assignments.size * 192;
    }

    #indexShifts(shiftsSlice: ShiftsSlice, program: ProgramIndex): EventShift[] {
        const shiftsByTeam = new Map<number, EventShift[]>();
        const shiftsByActivity = new Map<number, EventShift[]>();
        const shiftsByLocation = new Map<number, EventShift[]>();
        const allShifts: EventShift[] = [];

        for (const rawShift of shiftsSlice.shifts) {
            const locationId = rawShift.locationId ?? (
                rawShift.activityId !== undefined
                    ? program.getActivityLocationId(rawShift.activityId)
                    : undefined);
            const areaId = locationId !== undefined
                ? program.getLocation(locationId)?.areaId
                : undefined;

            const shift: EventShift = {
                id: rawShift.id,
                teamId: rawShift.teamId,
                categoryId: rawShift.categoryId,
                categoryName: rawShift.categoryName,
                countsContribution: rawShift.countsContribution,
                name: rawShift.name,
                description: rawShift.description,
                colour: rawShift.colour,
                excitement: rawShift.excitement,
                activityId: rawShift.activityId,
                locationId,
                areaId,
                isBackup: rawShift.name.startsWith('Backup'),
            };

            this.#shifts.set(shift.id, shift);
            allShifts.push(shift);
            this.#appendToMap(shiftsByTeam, shift.teamId, shift);

            if (shift.activityId !== undefined)
                this.#appendToMap(shiftsByActivity, shift.activityId, shift);
            if (shift.locationId !== undefined)
                this.#appendToMap(shiftsByLocation, shift.locationId, shift);
        }

        allShifts.sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));

        for (const [ teamId, list ] of shiftsByTeam) {
            list.sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));
            this.#shiftsByTeam.set(teamId, list);
        }
        for (const [ activityId, list ] of shiftsByActivity)
            this.#shiftsByActivity.set(activityId, list);
        for (const [ locationId, list ] of shiftsByLocation)
            this.#shiftsByLocation.set(locationId, list);

        return allShifts;
    }

    #indexAssignments(scheduleSlice: ScheduleSlice): IntervalIndex<EventShiftAssignment> {
        const assignmentsByShift = new Map<number, EventShiftAssignment[]>();
        const assignmentsByUser = new Map<number, EventShiftAssignment[]>();
        const assignmentsByActivity = new Map<number, EventShiftAssignment[]>();
        const assignmentsByLocation = new Map<number, EventShiftAssignment[]>();
        const assignmentsByArea = new Map<number, EventShiftAssignment[]>();
        const allAssignments: EventShiftAssignment[] = [];

        for (const raw of scheduleSlice.assignments) {
            const shift = this.#shifts.get(raw.shiftId);
            if (!shift || raw.endMs <= raw.startMs)
                continue;

            const assignment: EventShiftAssignment = {
                id: raw.id,
                shiftId: shift.id,
                userId: raw.userId,
                teamId: shift.teamId,
                activityId: shift.activityId,
                locationId: shift.locationId,
                areaId: shift.areaId,
                startMs: raw.startMs,
                endMs: raw.endMs,
            };

            this.#assignments.set(assignment.id, assignment);
            allAssignments.push(assignment);

            this.#appendToMap(assignmentsByShift, assignment.shiftId, assignment);
            this.#appendToMap(assignmentsByUser, assignment.userId, assignment);

            if (assignment.activityId !== undefined)
                this.#appendToMap(assignmentsByActivity, assignment.activityId, assignment);
            if (assignment.locationId !== undefined)
                this.#appendToMap(assignmentsByLocation, assignment.locationId, assignment);
            if (assignment.areaId !== undefined)
                this.#appendToMap(assignmentsByArea, assignment.areaId, assignment);
        }

        for (const [ shiftId, list ] of assignmentsByShift)
            this.#assignmentsByShift.set(shiftId, new IntervalIndex(list));

        for (const [ userId, list ] of assignmentsByUser) {
            list.sort((lhs, rhs) => lhs.startMs - rhs.startMs || lhs.endMs - rhs.endMs);
            this.#assignmentsByUser.set(userId, list);
        }

        for (const [ activityId, list ] of assignmentsByActivity)
            this.#assignmentsByActivity.set(activityId, new IntervalIndex(list));
        for (const [ locationId, list ] of assignmentsByLocation)
            this.#assignmentsByLocation.set(locationId, new IntervalIndex(list));
        for (const [ areaId, list ] of assignmentsByArea)
            this.#assignmentsByArea.set(areaId, new IntervalIndex(list));

        return new IntervalIndex(allAssignments);
    }

    #appendToMap<K, V>(map: Map<K, V[]>, key: K, value: V): void {
        const existing = map.get(key);
        if (existing)
            existing.push(value);
        else
            map.set(key, [ value ]);
    }

    #selectAssignmentIndex(
        filter?: ShiftAssignmentFilter): IntervalIndex<EventShiftAssignment> | undefined
    {
        if (filter?.shiftId !== undefined)
            return this.#assignmentsByShift.get(filter.shiftId);
        if (filter?.activityId !== undefined)
            return this.#assignmentsByActivity.get(filter.activityId);
        if (filter?.locationId !== undefined)
            return this.#assignmentsByLocation.get(filter.locationId);
        if (filter?.areaId !== undefined)
            return this.#assignmentsByArea.get(filter.areaId);

        return this.#allAssignments;
    }

    #filterAssignments(
        assignments: EventShiftAssignment[], filter?: ShiftAssignmentFilter): EventShiftAssignment[]
    {
        if (!filter)
            return assignments;

        return assignments.filter(assignment => {
            if (filter.shiftId !== undefined && assignment.shiftId !== filter.shiftId)
                return false;
            if (filter.teamId !== undefined && assignment.teamId !== filter.teamId)
                return false;
            if (filter.activityId !== undefined && assignment.activityId !== filter.activityId)
                return false;
            if (filter.locationId !== undefined && assignment.locationId !== filter.locationId)
                return false;
            if (filter.areaId !== undefined && assignment.areaId !== filter.areaId)
                return false;

            return true;
        });
    }
}
