// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { CachedEvent } from '@lib/cache';
import { AccessControl } from '@lib/auth/access';
import { EventState } from '@lib/event/EventState';
import { ProgramIndex } from '@lib/event/ProgramIndex';
import { ShiftIndex } from '@lib/event/ShiftIndex';
import { VolunteerIndex } from '@lib/event/VolunteerIndex';
import { getVolunteerTeamDetail, getVolunteerTeams } from './volunteerData';

import { kActivityType } from '@lib/database/Types';

const mockGetEventState = vi.fn();

vi.mock('@lib/event', () => ({
    getEventState: (...args: unknown[]) => mockGetEventState(...args),
}));

function buildMockEvent(): CachedEvent {
    return {
        id: 7,
        slug: '2026',
        name: 'AnimeCon 2026',
        shortName: 'AnimeCon 2026',
        startTime: Temporal.ZonedDateTime.from('2026-06-05T08:00:00Z[UTC]'),
        endTime: Temporal.ZonedDateTime.from('2026-06-07T20:00:00Z[UTC]'),
        timeZone: 'Europe/Amsterdam',
        flags: {
            enableHotel: false,
            enableRefunds: false,
            enableTraining: false,
        },
    } as CachedEvent;
}

function buildMockEventState(event: CachedEvent): EventState {
    const t12 = Temporal.ZonedDateTime.from('2026-06-06T12:00:00+02:00[Europe/Amsterdam]')
        .epochMilliseconds;
    const t15 = Temporal.ZonedDateTime.from('2026-06-06T15:00:00+02:00[Europe/Amsterdam]')
        .epochMilliseconds;

    const program = new ProgramIndex({
        areas: [
            { id: 1, name: 'Main Building', type: kActivityType.Program },
        ],
        locations: [
            { id: 10, areaId: 1, name: 'Main Hall', type: kActivityType.Program },
        ],
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
                    name: 'Lounge Support',
                    excitement: 0.5,
                    locationId: 10,
                },
                {
                    id: 51,
                    teamId: 1,
                    categoryId: 1,
                    categoryName: 'General',
                    countsContribution: true,
                    name: 'Backup',
                    excitement: 0.5,
                    locationId: 10,
                },
                {
                    id: 60,
                    teamId: 3,
                    categoryId: 1,
                    categoryName: 'General',
                    countsContribution: true,
                    name: 'Stewards Post',
                    excitement: 0.5,
                    locationId: 10,
                },
            ],
        },
        {
            assignments: [
                // Viewer (user 10, Crew Care): active on Lounge Support
                { id: 100, shiftId: 50, userId: 10, startMs: t12, endMs: t15 },
                // Multi-team volunteer (user 20, Crew + Stewards):
                //   Active on Crew Backup (visible)
                { id: 200, shiftId: 51, userId: 20, startMs: t12, endMs: t15 },
                // Multi-team volunteer (user 21, Crew + Stewards):
                //   Active ONLY on a hidden Stewards shift (must appear off-shift on Crew roster)
                { id: 201, shiftId: 60, userId: 21, startMs: t12, endMs: t15 },
                // Single-team Crew volunteer (user 22) borrowed onto a Stewards shift (visible)
                { id: 202, shiftId: 60, userId: 22, startMs: t12, endMs: t15 },
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
                {
                    id: 4,
                    slug: 'empty-team',
                    name: 'Empty Team',
                    title: 'Empty Team',
                    colourLight: '#0288d1',
                    colourDark: '#0288d1',
                    enableDutyBook: false,
                    enableScheduling: true,
                },
            ],
            roles: [
                { id: 1, name: 'Volunteer', order: 1, isLeader: false },
                { id: 2, name: 'Senior', order: 2, isLeader: true },
            ],
            teamVisibility: new Map([
                [ 2, new Set([ 1, 4 ]) ],  // Crew Care -> Crew, Empty Team
            ]),
        },
        {
            volunteers: [
                {
                    id: 10,
                    name: 'John Care',
                    firstName: 'John',
                    participations: [ { teamId: 2, roleId: 1 } ],
                    availability: { exceptions: [], requestedTimeslotIds: [] },
                },
                {
                    id: 20,
                    name: 'Alice Backup',
                    firstName: 'Alice',
                    participations: [
                        { teamId: 1, roleId: 1 },
                        { teamId: 3, roleId: 2 },
                    ],
                    availability: { exceptions: [], requestedTimeslotIds: [] },
                },
                {
                    id: 21,
                    name: 'Bob Multi',
                    firstName: 'Bob',
                    participations: [
                        { teamId: 1, roleId: 1 },
                        { teamId: 3, roleId: 1 },
                    ],
                    availability: { exceptions: [], requestedTimeslotIds: [] },
                },
                {
                    id: 22,
                    name: 'Clara Borrowed',
                    firstName: 'Clara',
                    participations: [ { teamId: 1, roleId: 2 } ],
                    availability: { exceptions: [], requestedTimeslotIds: [] },
                },
                {
                    id: 30,
                    name: 'Steward Only',
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

describe('volunteerData', () => {
    const currentTime = Temporal.ZonedDateTime.from('2026-06-06T13:00:00+02:00[Europe/Amsterdam]');

    beforeEach(() => {
        mockGetEventState.mockReset();
    });

    it('lists visible non-empty teams with active counts filtered by shift access', async () => {
        const event = buildMockEvent();
        mockGetEventState.mockResolvedValue(buildMockEventState(event));

        const teams = await getVolunteerTeams({
            access: new AccessControl({}),
            currentTime,
            event,
            user: { id: 10 },
        });

        // Crew Care (own) and Crew (standing visibility) appear; Stewards (hidden) and Empty Team
        // (0 volunteers) are excluded. Bob's hidden Stewards shift does not count in Crew active.
        expect(teams).toEqual([
            {
                activeCount: 2,
                activeFirstNames: [ 'Alice', 'Clara' ],
                colour: '#f57c00',
                isUserTeam: false,
                name: 'Crew',
                slug: 'crew',
                totalCount: 3,
            },
            {
                activeCount: 1,
                activeFirstNames: [ 'John' ],
                colour: '#c2185b',
                isUserTeam: true,
                name: 'Crew Care',
                slug: 'crew-care',
                totalCount: 1,
            },
        ]);
    });

    it('enforces team visibility and multi-team shift isolation on team rosters', async () => {
        const event = buildMockEvent();
        mockGetEventState.mockResolvedValue(buildMockEventState(event));

        const context = {
            access: new AccessControl({}),
            currentTime,
            event,
            user: { id: 10 },
        };

        const crew = await getVolunteerTeamDetail(context, 'crew');
        expect(crew?.volunteers).toEqual([
            {
                activeShift: 'Backup',
                avatar: undefined,
                id: 20,
                isBackup: true,
                name: 'Alice Backup',
                role: 'Volunteer',
                roleLeader: undefined,
                unavailableUntil: undefined,
            },
            {
                activeShift: undefined,  // hidden Stewards shift does not leak
                avatar: undefined,
                id: 21,
                isBackup: undefined,
                name: 'Bob Multi',
                role: 'Volunteer',
                roleLeader: undefined,
                unavailableUntil: undefined,
            },
            {
                activeShift: 'Stewards Post',  // single-team volunteer borrowed onto shared shift
                avatar: undefined,
                id: 22,
                isBackup: undefined,
                name: 'Clara Borrowed',
                role: 'Senior',
                roleLeader: true,
                unavailableUntil: undefined,
            },
        ]);

        // Hidden team returns undefined (page renders 404).
        expect(await getVolunteerTeamDetail(context, 'stewards')).toBeUndefined();
    });

    it('grants privileged team access via volunteers.participation:read', async () => {
        const event = buildMockEvent();
        mockGetEventState.mockResolvedValue(buildMockEventState(event));

        const context = {
            access: new AccessControl({
                grants: [
                    {
                        permission: 'volunteers.participation:read',
                        event: '2026',
                        team: 'stewards',
                    },
                ],
            }),
            currentTime,
            event,
            user: { id: 999 },  // non-participating staff
        };

        const teams = await getVolunteerTeams(context);
        expect(teams.map(team => team.slug)).toEqual([ 'stewards' ]);
        expect(teams[0].isUserTeam).toBe(false);

        const stewards = await getVolunteerTeamDetail(context, 'stewards');
        expect(stewards?.volunteers.map(v => v.id)).toEqual([ 20, 21, 30 ]);
    });
});
