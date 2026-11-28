// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { ProgramIndex } from './ProgramIndex';
import { ShiftIndex } from './ShiftIndex';

import { kActivityType } from '@lib/database/Types';

const kProgram = new ProgramIndex({
    areas: [
        { id: 1, name: 'Main Hall', type: kActivityType.Program },
        { id: 2, name: 'Ops', type: kActivityType.Internal },
    ],
    locations: [
        { id: 10, areaId: 1, name: 'Main Entrance', type: kActivityType.Program },
        { id: 20, areaId: 2, name: 'Ops Desk', type: kActivityType.Internal },
    ],
    activities: [
        { id: 100, title: 'Entrance Control', type: kActivityType.Program, visible: true },
    ],
    timeslots: [
        { id: 1000, activityId: 100, locationId: 10, startMs: 0, endMs: 10_000 },
    ],
});

const kShiftsSlice = {
    shifts: [
        {
            id: 1,
            teamId: 5,
            categoryId: 1,
            categoryName: 'Stewarding',
            countsContribution: true,
            name: 'Entrance',
            excitement: 0.5,
            activityId: 100,
        },
        {
            id: 2,
            teamId: 5,
            categoryId: 2,
            categoryName: 'Backup',
            countsContribution: true,
            name: 'Backup Stewards',
            excitement: 0.2,
            locationId: 20,
        },
    ],
};

const kScheduleSlice = {
    assignments: [
        { id: 501, shiftId: 1, userId: 10, startMs: 1000, endMs: 2000 },
        { id: 502, shiftId: 1, userId: 11, startMs: 2000, endMs: 4000 },
        { id: 503, shiftId: 1, userId: 12, startMs: 2000, endMs: 4000 },
        { id: 504, shiftId: 1, userId: 13, startMs: 4000, endMs: 6000 },
        { id: 505, shiftId: 2, userId: 14, startMs: 2500, endMs: 4500 },
    ],
};

describe('ShiftIndex', () => {
    it('resolves location and area from both direct locationId and linked activityId', () => {
        const index = new ShiftIndex(kShiftsSlice, kScheduleSlice, kProgram);

        const entrance = index.getShift(1);
        expect(entrance?.locationId).toBe(10);
        expect(entrance?.areaId).toBe(1);
        expect(entrance?.isBackup).toBe(false);

        const backup = index.getShift(2);
        expect(backup?.locationId).toBe(20);
        expect(backup?.areaId).toBe(2);
        expect(backup?.isBackup).toBe(true);
    });

    it('supports filtered active assignment queries across shifts, locations, and areas', () => {
        const index = new ShiftIndex(kShiftsSlice, kScheduleSlice, kProgram);

        expect(index.getActiveAssignmentsAt(3000).map(a => a.userId)).toEqual([ 11, 12, 14 ]);
        expect(index.getActiveAssignmentsAt(3000, { shiftId: 1 }).map(a => a.userId))
            .toEqual([ 11, 12 ]);
        expect(index.getActiveAssignmentsAt(3000, { areaId: 2 }).map(a => a.userId))
            .toEqual([ 14 ]);
        expect(index.getActiveAssignmentsAt(3000, { locationId: 10 }).map(a => a.userId))
            .toEqual([ 11, 12 ]);
    });

    it('returns previous, active, and next relief waves for a shift', () => {
        const index = new ShiftIndex(kShiftsSlice, kScheduleSlice, kProgram);

        const handover = index.getShiftStateAt(1, 2500);
        expect(handover).toBeDefined();
        expect(handover!.previous.map(a => a.userId)).toEqual([ 10 ]);
        expect(handover!.active.map(a => a.userId)).toEqual([ 11, 12 ]);
        expect(handover!.next.map(a => a.userId)).toEqual([ 13 ]);
    });

    it('finds the next scheduled assignment for a volunteer after a given instant', () => {
        const index = new ShiftIndex(kShiftsSlice, kScheduleSlice, kProgram);

        expect(index.getNextAssignmentForVolunteer(10, 500)?.id).toBe(501);
        expect(index.getNextAssignmentForVolunteer(10, 1000)).toBeUndefined();
        expect(index.getNextAssignmentForVolunteer(999, 0)).toBeUndefined();
    });
});
