// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Active scheduled shift instance for an event.
 */
export interface VolunteerAccessShift {
    scheduleId: number;
    userId: number;
    shiftId: number;
    shiftTeamId: number;
    activityId?: number;
    startMs: number;
    endMs: number;
}

/**
 * Visible colleague schedule IDs relative to one of the viewer's own shifts.
 */
export interface ShiftColleagues {
    /**
     * Schedule IDs ending exactly as the viewer's shift starts.
     */
    outgoing: readonly number[];

    /**
     * Schedule IDs overlapping the viewer's shift in time.
     */
    overlapping: readonly number[];

    /**
     * Schedule IDs starting exactly as the viewer's shift ends.
     */
    incoming: readonly number[];
}

/**
 * Empty colleague grouping returned for unknown or non-viewer schedule IDs.
 */
const kEmptyShiftColleagues: ShiftColleagues = {
    outgoing: [],
    overlapping: [],
    incoming: [],
};

/**
 * Precomputed index of scheduled shifts and shared-shift/handoff colleagues relative to a single
 * viewer. This class is an internal implementation detail of `VolunteerAccess`.
 */
export class SharedShiftIndex {
    readonly #shiftsById = new Map<number, VolunteerAccessShift>();
    readonly #coShiftUsers = new Set<number>();
    readonly #coShiftScheduleIds = new Set<number>();
    readonly #shiftColleagues = new Map<number, ShiftColleagues>();

    constructor(
        viewerUserId: number,
        shifts: readonly VolunteerAccessShift[],
        participants: ReadonlyMap<number, unknown>)
    {
        const viewerShifts: VolunteerAccessShift[] = [];
        const otherShifts: VolunteerAccessShift[] = [];

        for (const shift of shifts) {
            this.#shiftsById.set(shift.scheduleId, shift);

            if (shift.userId === viewerUserId)
                viewerShifts.push(shift);
            else if (participants.has(shift.userId))
                otherShifts.push(shift);
        }

        for (const viewerShift of viewerShifts) {
            const outgoing: number[] = [];
            const overlapping: number[] = [];
            const incoming: number[] = [];

            for (const otherShift of otherShifts) {
                const relation = this.#classifyRelation(viewerShift, otherShift);
                if (!relation)
                    continue;

                this.#coShiftUsers.add(otherShift.userId);
                this.#coShiftScheduleIds.add(otherShift.scheduleId);

                if (relation === 'outgoing')
                    outgoing.push(otherShift.scheduleId);
                else if (relation === 'incoming')
                    incoming.push(otherShift.scheduleId);
                else
                    overlapping.push(otherShift.scheduleId);
            }

            if (outgoing.length > 0 || overlapping.length > 0 || incoming.length > 0) {
                this.#shiftColleagues.set(
                    viewerShift.scheduleId, { outgoing, overlapping, incoming });
            }
        }
    }

    /**
     * Returns the scheduled shift record for `scheduleId`, if present in the event.
     */
    getShift(scheduleId: number): VolunteerAccessShift | undefined {
        return this.#shiftsById.get(scheduleId);
    }

    /**
     * Returns whether `userId` shares or hands off at least one shift with the viewer.
     */
    hasColleague(userId: number): boolean {
        return this.#coShiftUsers.has(userId);
    }

    /**
     * Returns whether `scheduleId` is a colleague shift overlapping or touching one of the viewer's
     * own shifts.
     */
    isColleagueShift(scheduleId: number): boolean {
        return this.#coShiftScheduleIds.has(scheduleId);
    }

    /**
     * Returns visible colleague schedule IDs (outgoing, overlapping, and incoming) for one of the
     * viewer's own shifts.
     */
    getColleagues(viewerScheduleId: number): ShiftColleagues {
        return this.#shiftColleagues.get(viewerScheduleId) ?? kEmptyShiftColleagues;
    }

    /**
     * Classifies the temporal relationship between `viewerShift` and `otherShift` when they share
     * either the same shift definition or the same non-null program activity. Returns `undefined`
     * when the shifts do not share work context or do not overlap or touch exactly.
     */
    #classifyRelation(
        viewerShift: VolunteerAccessShift,
        otherShift: VolunteerAccessShift): 'outgoing' | 'overlapping' | 'incoming' | undefined
    {
        const sharesShift = otherShift.shiftId === viewerShift.shiftId;
        const sharesActivity =
            viewerShift.activityId !== undefined &&
            otherShift.activityId === viewerShift.activityId;

        if (!sharesShift && !sharesActivity)
            return undefined;

        if (otherShift.startMs > viewerShift.endMs || viewerShift.startMs > otherShift.endMs)
            return undefined;

        if (otherShift.startMs < viewerShift.endMs && viewerShift.startMs < otherShift.endMs)
            return 'overlapping';

        if (otherShift.endMs === viewerShift.startMs && otherShift.startMs < viewerShift.startMs)
            return 'outgoing';

        if (otherShift.startMs === viewerShift.endMs && otherShift.endMs > viewerShift.endMs)
            return 'incoming';

        return 'overlapping';
    }
}
