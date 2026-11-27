// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { CachedEvent } from '@lib/cache';
import { AccessControl } from '@lib/auth/access';
import { Cache } from '@lib/cache';
import { EventState } from '@lib/event/EventState';
import { ProgramIndex } from '@lib/event/ProgramIndex';
import { ShiftIndex } from '@lib/event/ShiftIndex';
import { VolunteerIndex } from '@lib/event/VolunteerIndex';
import { getVolunteerAccess } from './loadVolunteerAccess';

const mockGetEventState = vi.fn();

vi.mock('@lib/event', () => ({
    getEventState: (...args: unknown[]) => mockGetEventState(...args),
}));

function buildMockEvent(): CachedEvent {
    const startTime = Temporal.ZonedDateTime.from('2026-06-05T08:00:00Z[UTC]');
    const endTime = Temporal.ZonedDateTime.from('2026-06-07T20:00:00Z[UTC]');

    return {
        id: 7,
        slug: '2026',
        name: 'AnimeCon 2026',
        shortName: 'AnimeCon 2026',
        startTime,
        endTime,
        timeZone: 'Europe/Amsterdam',
        flags: {
            enableHotel: false,
            enableRefunds: false,
            enableTraining: false,
        },
    } as CachedEvent;
}

function buildMockEventState(event: CachedEvent): EventState {
    const startA = Temporal.ZonedDateTime.from('2026-06-06T12:00:00Z[UTC]').epochMilliseconds;
    const endA = Temporal.ZonedDateTime.from('2026-06-06T15:00:00Z[UTC]').epochMilliseconds;
    const endB = Temporal.ZonedDateTime.from('2026-06-06T18:00:00Z[UTC]').epochMilliseconds;

    const program = new ProgramIndex({
        areas: [],
        locations: [],
        activities: [],
        timeslots: [],
    });

    const shifts = new ShiftIndex(
        {
            shifts: [
                {
                    id: 50,
                    teamId: 2,
                    categoryId: 1,
                    categoryName: 'General',
                    countsContribution: true,
                    name: 'Lounge',
                    excitement: 0.5,
                    activityId: 500,
                },
                {
                    id: 60,
                    teamId: 3,
                    categoryId: 1,
                    categoryName: 'General',
                    countsContribution: true,
                    name: 'Main Hall',
                    excitement: 0.5,
                    activityId: 500,
                },
            ],
        },
        {
            assignments: [
                { id: 100, shiftId: 50, userId: 10, startMs: startA, endMs: endA },
                { id: 101, shiftId: 60, userId: 30, startMs: endA, endMs: endB },
            ],
        },
        program);

    const volunteers = new VolunteerIndex(
        {
            teams: [
                {
                    id: 1,
                    slug: 'crew',
                    name: 'Crew',
                    title: 'Crew',
                    colourLight: '#f57c00',
                    colourDark: '#f57c00',
                    enableDutyBook: false,
                    enableScheduling: true,
                },
                {
                    id: 2,
                    slug: 'crew-care',
                    name: 'Crew Care',
                    title: 'Crew Care',
                    colourLight: '#c2185b',
                    colourDark: '#c2185b',
                    enableDutyBook: false,
                    enableScheduling: true,
                },
                {
                    id: 3,
                    slug: 'stewards',
                    name: 'Stewards',
                    title: 'Stewards',
                    colourLight: '#689f38',
                    colourDark: '#689f38',
                    enableDutyBook: false,
                    enableScheduling: true,
                },
            ],
            roles: [
                { id: 1, name: 'Volunteer', order: 1, isLeader: false },
                { id: 2, name: 'Senior', order: 2, isLeader: true },
            ],
            teamVisibility: new Map([
                [ 2, new Set([ 1 ]) ],  // Crew Care -> Crew
            ]),
        },
        {
            volunteers: [
                {
                    id: 10,
                    name: 'Viewer Care',
                    firstName: 'Viewer',
                    participations: [ { teamId: 2, roleId: 1 } ],
                    availability: { exceptions: [], requestedTimeslotIds: [] },
                },
                {
                    id: 20,
                    name: 'Crew Lead',
                    firstName: 'Crew',
                    participations: [ { teamId: 1, roleId: 2 } ],
                    availability: { exceptions: [], requestedTimeslotIds: [] },
                },
                {
                    id: 30,
                    name: 'Steward Next',
                    firstName: 'Steward',
                    participations: [ { teamId: 3, roleId: 1 } ],
                    availability: { exceptions: [], requestedTimeslotIds: [] },
                },
            ],
        },
        {
            startTime: event.startTime,
            endTime: event.endTime,
            timeZone: event.timeZone,
            boundaryHours: { beforeStart: 2, afterEnd: 0 },
        },
        program,
        shifts);

    return new EventState({
        eventId: event.id,
        eventSlug: event.slug,
        timeZone: event.timeZone,
        program,
        shifts,
        volunteers,
    });
}

describe('loadVolunteerAccess', () => {
    beforeEach(() => {
        mockGetEventState.mockReset();
        Cache.getInstance('EventState').clear();
    });

    it('builds VolunteerAccess from EventState with visibility edges and handoffs', async () => {
        const event = buildMockEvent();
        mockGetEventState.mockResolvedValue(buildMockEventState(event));

        const policy = await getVolunteerAccess({
            access: new AccessControl({}),
            event,
            user: { id: 10 },
        });

        expect([ ...policy.memberTeams ]).toEqual([ 2 ]);
        expect(policy.visibleTeams).toEqual(new Set([ 1, 2 ]));
        expect(policy.canSeeTeam('crew')).toBe(true);
        expect(policy.canSeeTeam('stewards')).toBe(false);

        expect(policy.queryVolunteer(20)).toEqual({
            level: 'full',
            isSelf: false,
            visibleTeamIds: new Set([ 1 ]),
            canEditAvatar: false,
            canViewPhoneNumber: true,
            readableNoteTeamIds: new Set(),
            editableNoteTeamIds: new Set(),
        });

        expect(policy.queryVolunteer(30)).toEqual({
            level: 'shared-shift',
            isSelf: false,
            canEditAvatar: false,
            canViewPhoneNumber: false,
        });
        expect(policy.queryShiftColleagues(100)).toEqual({
            outgoing: [],
            overlapping: [],
            incoming: [ 101 ],
        });
    });

    it('fails closed with an empty policy when EventState is unavailable', async () => {
        const event = buildMockEvent();
        mockGetEventState.mockResolvedValue(undefined);

        const policy = await getVolunteerAccess({
            access: new AccessControl({}),
            event,
            user: { id: 10 },
        });

        expect(policy.visibleTeams.size).toBe(0);
        expect(policy.queryVolunteer(20)).toBeUndefined();
    });
});
