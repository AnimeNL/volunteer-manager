// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { CachedEvent } from '@lib/cache';
import type { EventStateDataSource } from './EventStateLoader';
import { Cache } from '@lib/cache';
import { getEventState, invalidateEventProgram, invalidateEventState } from './EventState';

import { kActivityType } from '@lib/database/Types';

const kTimeZone = 'Europe/Amsterdam';

function zdt(iso: string): Temporal.ZonedDateTime {
    return Temporal.ZonedDateTime.from(`${iso}[${kTimeZone}]`);
}

function ms(iso: string): number {
    return zdt(iso).epochMilliseconds;
}

function createMockEvent(id = 42, festivalId = 9001): CachedEvent {
    return {
        id,
        slug: '2026',
        name: 'AnimeCon 2026',
        shortName: 'AnimeCon 2026',
        published: true,
        startTime: zdt('2026-06-12T12:00:00+02:00'),
        endTime: zdt('2026-06-14T18:00:00+02:00'),
        timeZone: kTimeZone,
        flags: {
            enableBuildUp: false,
            enableHotel: false,
            enableRefunds: false,
            enableTearDown: false,
            enableTraining: false,
        },
        integrations: {
            anPlanFestivalId: festivalId,
        },
    };
}

function createSpyLoaders() {
    let shiftTitle = 'Entrance';
    let assignmentEnd = ms('2026-06-13T16:00:00+02:00');
    let volunteerName = 'John Doe';

    const counts = {
        boundaryHours: 0,
        program: 0,
        teams: 0,
        volunteers: 0,
        singleVolunteer: 0,
        shifts: 0,
        schedule: 0,
    };

    const loaders: EventStateDataSource = {
        loadBoundaryHours: async () => {
            counts.boundaryHours++;
            return { beforeStart: 4, afterEnd: 2 };
        },
        loadProgram: async () => {
            counts.program++;
            return {
                areas: [ { id: 1, name: 'Main Hall', type: kActivityType.Program } ],
                locations: [
                    { id: 10, areaId: 1, name: 'Main Entrance', type: kActivityType.Program },
                ],
                activities: [
                    {
                        id: 100,
                        title: 'Entrance Control',
                        type: kActivityType.Program,
                        visible: true,
                    },
                ],
                timeslots: [
                    {
                        id: 1000,
                        activityId: 100,
                        locationId: 10,
                        startMs: ms('2026-06-13T12:00:00+02:00'),
                        endMs: ms('2026-06-13T18:00:00+02:00'),
                    },
                ],
            };
        },
        loadTeams: async () => {
            counts.teams++;
            return {
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
                roles: [ { id: 1, name: 'Steward', order: 1, isLeader: false } ],
            };
        },
        loadVolunteers: async () => {
            counts.volunteers++;
            return {
                volunteers: [
                    {
                        id: 7,
                        name: volunteerName,
                        firstName: volunteerName.split(' ')[0],
                        participations: [ { teamId: 5, roleId: 1 } ],
                        availability: {
                            preferenceTimingStart: 10,
                            preferenceTimingEnd: 22,
                            exceptions: [],
                            requestedTimeslotIds: [],
                        },
                    },
                ],
            };
        },
        loadSingleVolunteer: async (_eventId, userId) => {
            counts.singleVolunteer++;
            if (userId !== 7)
                return undefined;

            return {
                id: 7,
                name: volunteerName,
                firstName: volunteerName.split(' ')[0],
                participations: [ { teamId: 5, roleId: 1 } ],
                availability: {
                    preferenceTimingStart: 10,
                    preferenceTimingEnd: 22,
                    exceptions: [],
                    requestedTimeslotIds: [],
                },
            };
        },
        loadShifts: async () => {
            counts.shifts++;
            return {
                shifts: [
                    {
                        id: 1,
                        teamId: 5,
                        categoryId: 1,
                        categoryName: 'Stewarding',
                        countsContribution: true,
                        name: shiftTitle,
                        excitement: 0.5,
                        activityId: 100,
                    },
                ],
            };
        },
        loadSchedule: async () => {
            counts.schedule++;
            return {
                assignments: [
                    {
                        id: 501,
                        shiftId: 1,
                        userId: 7,
                        startMs: ms('2026-06-13T14:00:00+02:00'),
                        endMs: assignmentEnd,
                    },
                ],
            };
        },
    };

    return {
        counts,
        loaders,
        setShiftTitle: (next: string) => { shiftTitle = next; },
        setAssignmentEnd: (next: number) => { assignmentEnd = next; },
        setVolunteerName: (next: string) => { volunteerName = next; },
    };
}

describe('EventState', () => {
    beforeEach(() => {
        Cache.getInstance('EventState').clear();
    });

    it('caches permanently, coalesces concurrent loads, and serves state.at(time)', async () => {
        const event = createMockEvent();
        const { counts, loaders } = createSpyLoaders();

        const [ first, second ] = await Promise.all([
            getEventState(event, loaders),
            getEventState(event, loaders),
        ]);

        expect(first).toBeDefined();
        expect(first).toBe(second);
        expect(counts).toEqual({
            boundaryHours: 1,
            program: 1,
            teams: 1,
            volunteers: 1,
            singleVolunteer: 0,
            shifts: 1,
            schedule: 1,
        });

        const snapshot = first!.at(zdt('2026-06-13T14:50:00+02:00'));
        expect(snapshot.activeTimeslots({ areaId: 1 }).map(slot => slot.id)).toEqual([ 1000 ]);
        expect(snapshot.volunteer(7)?.status).toBe('on-shift');
        expect(snapshot.volunteer(7)?.activeShift?.name).toBe('Entrance');
        expect(snapshot.nextTransition()).toBe(ms('2026-06-13T16:00:00+02:00'));

        // Cache diagnostics byte size should reflect actual data rather than "{}" (2 bytes).
        const metadata = Cache.getInstance('EventState').getMetadata(event.id);
        expect(metadata?.bytes).toBeGreaterThan(500);
    });

    it('supports lazy slice-level and single-volunteer partial invalidation', async () => {
        const event = createMockEvent();
        const { counts, loaders, setAssignmentEnd, setShiftTitle, setVolunteerName } =
            createSpyLoaders();

        await getEventState(event, loaders);

        // (1) Schedule-only invalidation reloads ONLY `schedule`.
        setAssignmentEnd(ms('2026-06-13T17:00:00+02:00'));
        await invalidateEventState(event.id, 'schedule');

        const afterSchedule = (await getEventState(event, loaders))!;
        expect(counts.schedule).toBe(2);
        expect(counts.program).toBe(1);
        expect(counts.volunteers).toBe(1);
        expect(counts.shifts).toBe(1);
        expect(afterSchedule.at(zdt('2026-06-13T16:30:00+02:00')).volunteer(7)?.status)
            .toBe('on-shift');

        // (2) Single-volunteer surgical invalidation reloads ONLY that volunteer.
        setVolunteerName('Johnny Doe');
        await invalidateEventState(event.id, { volunteer: 7 });

        const afterVolunteer = (await getEventState(event, loaders))!;
        expect(counts.volunteers).toBe(1);
        expect(counts.singleVolunteer).toBe(1);
        expect(afterVolunteer.volunteers.getVolunteer(7)?.name).toBe('Johnny Doe');

        // (3) Festival program invalidation reloads ONLY `program`.
        invalidateEventProgram(9001);
        await getEventState(event, loaders);
        expect(counts.program).toBe(2);
        expect(counts.teams).toBe(1);

        // (4) Full invalidation clears the entry and reloads all slices.
        setShiftTitle('VIP Entrance');
        await invalidateEventState(event.id);

        const afterFull = (await getEventState(event, loaders))!;
        expect(counts.boundaryHours).toBe(2);
        expect(counts.shifts).toBe(2);
        expect(afterFull.shifts.getShift(1)?.name).toBe('VIP Entrance');
    });
});
