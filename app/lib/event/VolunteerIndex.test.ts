// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { ProgramIndex } from './ProgramIndex';
import { ShiftIndex } from './ShiftIndex';
import { VolunteerIndex } from './VolunteerIndex';

import { kActivityType } from '@lib/database/Types';

const kTimeZone = 'Europe/Amsterdam';

function zdt(iso: string): Temporal.ZonedDateTime {
    return Temporal.ZonedDateTime.from(`${iso}[${kTimeZone}]`);
}

function ms(iso: string): number {
    return zdt(iso).epochMilliseconds;
}

const kContext = {
    startTime: zdt('2026-06-12T12:00:00+02:00'),
    endTime: zdt('2026-06-14T18:00:00+02:00'),
    timeZone: kTimeZone,
    boundaryHours: { beforeStart: 4, afterEnd: 2 },
};

const kProgram = new ProgramIndex({
    areas: [ { id: 1, name: 'Main Hall', type: kActivityType.Program } ],
    locations: [ { id: 10, areaId: 1, name: 'Main Entrance', type: kActivityType.Program } ],
    activities: [
        { id: 100, title: 'Entrance Control', type: kActivityType.Program, visible: true },
        { id: 101, title: 'Cosplay Show', type: kActivityType.Program, visible: true },
    ],
    timeslots: [
        {
            id: 1000,
            activityId: 101,
            locationId: 10,
            startMs: ms('2026-06-13T17:00:00+02:00'),
            endMs: ms('2026-06-13T18:00:00+02:00'),
        },
    ],
});

const kShifts = new ShiftIndex(
    {
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
                name: 'Backup',
                excitement: 0.2,
                locationId: 10,
            },
        ],
    },
    {
        assignments: [
            {
                id: 501,
                shiftId: 1,
                userId: 1,
                startMs: ms('2026-06-13T14:00:00+02:00'),
                endMs: ms('2026-06-13T16:00:00+02:00'),
            },
            {
                id: 502,
                shiftId: 1,
                userId: 1,
                startMs: ms('2026-06-13T19:00:00+02:00'),
                endMs: ms('2026-06-13T21:00:00+02:00'),
            },
            {
                id: 503,
                shiftId: 2,
                userId: 2,
                startMs: ms('2026-06-13T14:00:00+02:00'),
                endMs: ms('2026-06-13T16:00:00+02:00'),
            },
        ],
    },
    kProgram);

const kTeamsSlice = {
    teams: [
        {
            id: 5,
            slug: 'stewards',
            name: 'Stewards',
            title: 'Stewards',
            colourLight: '#689f38',
            colourDark: '#8bc34a',
            enableDutyBook: true,
            enableScheduling: true,
        },
    ],
    roles: [
        { id: 1, name: 'Steward', order: 2, isLeader: false },
        { id: 2, name: 'Senior Steward', order: 1, isLeader: true },
    ],
};

const kVolunteersSlice = {
    volunteers: [
        {
            id: 1,
            name: 'John Doe',
            firstName: 'John',
            participations: [ { teamId: 5, roleId: 1 } ],
            availability: {
                preferenceTimingStart: 10,
                preferenceTimingEnd: 22,
                exceptions: [
                    {
                        startMs: ms('2026-06-13T16:00:00+02:00'),
                        endMs: ms('2026-06-13T17:30:00+02:00'),
                        state: 'unavailable' as const,
                    },
                    {
                        startMs: ms('2026-06-13T18:00:00+02:00'),
                        endMs: ms('2026-06-13T19:00:00+02:00'),
                        state: 'avoid' as const,
                    },
                ],
                requestedTimeslotIds: [ 1000 ],
            },
        },
        {
            id: 2,
            name: 'Alice Smith',
            firstName: 'Alice',
            participations: [ { teamId: 5, roleId: 2 } ],
            availability: {
                preferenceTimingStart: 10,
                preferenceTimingEnd: 22,
                exceptions: [],
                requestedTimeslotIds: [],
            },
        },
    ],
};

describe('VolunteerIndex', () => {
    it('resolves lateral volunteer state, return time, and treats avoid as available', () => {
        const index = new VolunteerIndex(
            kTeamsSlice, kVolunteersSlice, kContext, kProgram, kShifts);

        // At 14:50, John is on Entrance shift; next is his 16:00–17:30 unavailable exception.
        const onShift = index.getVolunteerStateAt(1, ms('2026-06-13T14:50:00+02:00'))!;
        expect(onShift.status).toBe('on-shift');
        expect(onShift.activeShift?.name).toBe('Entrance');
        expect(onShift.isBackup).toBe(false);
        expect(onShift.next).toMatchObject({
            kind: 'unavailable',
            reason: 'exception',
            startMs: ms('2026-06-13T16:00:00+02:00'),
            endMs: ms('2026-06-13T17:30:00+02:00'),
        });
        expect(onShift.nextShift?.id).toBe(502);

        // At 16:30, John is unavailable and returns at 17:30.
        const unavailable = index.getVolunteerStateAt(1, ms('2026-06-13T16:30:00+02:00'))!;
        expect(unavailable.status).toBe('unavailable');
        expect(unavailable.availableAgainAtMs).toBe(ms('2026-06-13T17:30:00+02:00'));

        // At 18:30, John has an 'avoid' exception, which maps to live status 'available' (off shift).
        const avoidWindow = index.getVolunteerStateAt(1, ms('2026-06-13T18:30:00+02:00'))!;
        expect(avoidWindow.status).toBe('available');
        expect(avoidWindow.current).toMatchObject({ kind: 'avoid', reason: 'exception' });
    });

    it('detects backup shifts, leaders, and indefinite unavailability after event end', () => {
        const index = new VolunteerIndex(
            kTeamsSlice, kVolunteersSlice, kContext, kProgram, kShifts);

        const alice = index.getVolunteerStateAt(2, ms('2026-06-13T14:50:00+02:00'))!;
        expect(alice.status).toBe('on-shift');
        expect(alice.isBackup).toBe(true);
        expect(alice.volunteer.isLeader).toBe(true);

        const afterEvent = index.getVolunteerStateAt(2, ms('2026-06-14T21:00:00+02:00'))!;
        expect(afterEvent.status).toBe('unavailable');
        expect(afterEvent.availableAgainAtMs).toBeUndefined();
    });

    it('supports on-demand timeline compilation with requested program events', () => {
        const index = new VolunteerIndex(
            kTeamsSlice, kVolunteersSlice, kContext, kProgram, kShifts);

        const withRequested = index.getTimeline(1, { includeRequestedEvents: true });
        const requestedSegment = withRequested.find(
            segment => segment.kind === 'avoid' && segment.reason === 'requested-event');

        expect(requestedSegment).toBeDefined();
        expect(requestedSegment).toMatchObject({
            timeslotId: 1000,
            activityId: 101,
            startMs: ms('2026-06-13T17:30:00+02:00'),  // 17:00–17:30 was overridden by unavailable
            endMs: ms('2026-06-13T18:00:00+02:00'),
        });
    });
});
