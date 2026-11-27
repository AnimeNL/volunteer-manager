// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { VolunteerAccessParams } from './VolunteerAccess';
import { AccessControl } from '@lib/auth/access';
import { VolunteerAccess } from './VolunteerAccess';

import { kAnyEvent, kAnyTeam } from '@lib/auth/access';

const kEventSlug = '2026';

const kTeamCrew = { id: 1, slug: 'crew' };
const kTeamCrewCare = { id: 2, slug: 'crew-care' };
const kTeamStewards = { id: 3, slug: 'stewards' };
const kTeamHosts = { id: 4, slug: 'hosts' };

const kDefaultTeams = [ kTeamCrew, kTeamCrewCare, kTeamStewards, kTeamHosts ];

const kHourMs = 60 * 60 * 1000;
const hour = (offsetHours: number) => 1_780_000_000_000 + offsetHours * kHourMs;

function createPolicy(overrides: Partial<VolunteerAccessParams> = {}): VolunteerAccess {
    return new VolunteerAccess({
        viewerUserId: 100,
        eventSlug: kEventSlug,
        access: new AccessControl({}),
        teams: kDefaultTeams,
        teamVisibility: new Map(),
        participations: [],
        shifts: [],
        ...overrides,
    });
}

describe('VolunteerAccess', () => {
    describe('own team and default isolation', () => {
        it('grants full access to own team and isolates unrelated teams by default', () => {
            const policy = createPolicy({
                viewerUserId: 1,
                participations: [
                    { userId: 1, teamId: kTeamCrew.id, isLeader: false },
                    { userId: 2, teamId: kTeamCrew.id, isLeader: false },
                    { userId: 3, teamId: kTeamStewards.id, isLeader: true },
                ],
                shifts: [
                    {
                        scheduleId: 10,
                        userId: 1,
                        shiftId: 500,
                        shiftTeamId: kTeamStewards.id,
                        startMs: hour(10),
                        endMs: hour(12),
                    },
                    {
                        scheduleId: 11,
                        userId: 2,
                        shiftId: 501,
                        shiftTeamId: kTeamCrew.id,
                        startMs: hour(10),
                        endMs: hour(12),
                    },
                    {
                        scheduleId: 12,
                        userId: 3,
                        shiftId: 502,
                        shiftTeamId: kTeamStewards.id,
                        startMs: hour(14),
                        endMs: hour(16),
                    },
                ],
            });

            expect([ ...policy.memberTeams ]).toEqual([ kTeamCrew.id ]);
            expect([ ...policy.visibleTeams ]).toEqual([ kTeamCrew.id ]);

            expect(policy.isMemberTeam(kTeamCrew.id)).toBe(true);
            expect(policy.isMemberTeam('crew')).toBe(true);
            expect(policy.isMemberTeam('stewards')).toBe(false);

            expect(policy.canSeeTeam(kTeamCrew.id)).toBe(true);
            expect(policy.canSeeTeam('crew')).toBe(true);
            expect(policy.canSeeTeam('stewards')).toBe(false);
            expect(policy.canSeeTeam('unknown')).toBe(false);
            expect(policy.requireTeam('crew')).toBe(kTeamCrew.id);
            expect(() => policy.requireTeam('stewards')).toThrow(/404/);
            expect(() => policy.requireTeam('unknown')).toThrow(/404/);

            // Self: sees own phone number, can edit own avatar, sees own shift on any team.
            expect(policy.queryVolunteer(1)).toEqual({
                level: 'full',
                isSelf: true,
                visibleTeamIds: new Set([ kTeamCrew.id ]),
                canEditAvatar: true,
                canViewPhoneNumber: true,
                readableNoteTeamIds: new Set(),
                editableNoteTeamIds: new Set(),
            });
            expect(policy.canSeeShift(10)).toBe(true);

            // Regular teammate: visible, no phone number or notes.
            expect(policy.queryVolunteer(2)).toEqual({
                level: 'full',
                isSelf: false,
                visibleTeamIds: new Set([ kTeamCrew.id ]),
                canEditAvatar: false,
                canViewPhoneNumber: false,
                readableNoteTeamIds: new Set(),
                editableNoteTeamIds: new Set(),
            });
            expect(policy.canSeeShift(11)).toBe(true);

            // Unrelated team volunteer: completely hidden.
            expect(policy.queryVolunteer(3)).toBeUndefined();
            expect(() => policy.requireVolunteer(3)).toThrow(/404/);
            expect(policy.canSeeShift(12)).toBe(false);
            expect(policy.canSeeShift(999)).toBe(false);
        });

        it('ignores participations in teams disabled for the event', () => {
            const policy = createPolicy({
                viewerUserId: 1,
                teams: [ kTeamCrew ],
                participations: [
                    { userId: 1, teamId: kTeamCrew.id, isLeader: false },
                    { userId: 2, teamId: kTeamHosts.id, isLeader: false },
                ],
                teamVisibility: new Map([
                    [ kTeamCrew.id, new Set([ kTeamHosts.id ]) ],
                ]),
            });

            expect([ ...policy.visibleTeams ]).toEqual([ kTeamCrew.id ]);
            expect(policy.queryVolunteer(2)).toBeUndefined();
        });
    });

    describe('directional standing team visibility', () => {
        it('grants 1-hop directional visibility without reverse or transitive leakage', () => {
            const teamVisibility = new Map<number, ReadonlySet<number>>([
                [ kTeamCrewCare.id, new Set([ kTeamCrew.id ]) ],
                [ kTeamCrew.id, new Set([ kTeamStewards.id ]) ],
            ]);

            const participations = [
                { userId: 1, teamId: kTeamCrewCare.id, isLeader: false },
                { userId: 2, teamId: kTeamCrew.id, isLeader: true },
                { userId: 3, teamId: kTeamStewards.id, isLeader: false },
            ];

            // Crew Care sees Crew (1-hop), but NOT Stewards (2-hop transitive).
            const crewCarePolicy = createPolicy({
                viewerUserId: 1,
                teamVisibility,
                participations,
            });
            expect([ ...crewCarePolicy.memberTeams ]).toEqual([ kTeamCrewCare.id ]);
            expect(crewCarePolicy.visibleTeams).toEqual(
                new Set([ kTeamCrewCare.id, kTeamCrew.id ]));
            expect(crewCarePolicy.isMemberTeam('crew')).toBe(false);
            expect(crewCarePolicy.canSeeTeam('crew')).toBe(true);
            expect(crewCarePolicy.canSeeTeam('stewards')).toBe(false);

            // Leader in collaborating team has visible phone number, but no note access.
            expect(crewCarePolicy.queryVolunteer(2)).toEqual({
                level: 'full',
                isSelf: false,
                visibleTeamIds: new Set([ kTeamCrew.id ]),
                canEditAvatar: false,
                canViewPhoneNumber: true,
                readableNoteTeamIds: new Set(),
                editableNoteTeamIds: new Set(),
            });
            expect(crewCarePolicy.queryVolunteer(3)).toBeUndefined();

            // Crew does NOT see Crew Care because the edge is directional.
            const crewPolicy = createPolicy({
                viewerUserId: 2,
                teamVisibility,
                participations,
            });
            expect(crewPolicy.visibleTeams).toEqual(new Set([ kTeamCrew.id, kTeamStewards.id ]));
            expect(crewPolicy.canSeeTeam('crew-care')).toBe(false);
            expect(crewPolicy.queryVolunteer(1)).toBeUndefined();
        });
    });

    describe('privileged team-scoped access', () => {
        it('grants team visibility via participation:read or schedules:read per team', () => {
            const access = new AccessControl({
                grants: [
                    {
                        permission: 'volunteers.participation:read',
                        event: kEventSlug,
                        team: 'crew',
                    },
                    {
                        permission: 'volunteers.schedules:read',
                        event: kEventSlug,
                        team: 'stewards',
                    },
                    { permission: 'volunteers.participation:read', event: '2025', team: 'hosts' },
                ],
            });

            const policy = createPolicy({
                viewerUserId: 99,  // non-participating staff
                access,
                participations: [
                    { userId: 1, teamId: kTeamCrew.id, isLeader: false },
                    { userId: 2, teamId: kTeamStewards.id, isLeader: false },
                    { userId: 3, teamId: kTeamHosts.id, isLeader: false },
                ],
            });

            expect(policy.memberTeams.size).toBe(0);
            expect(policy.visibleTeams).toEqual(new Set([ kTeamCrew.id, kTeamStewards.id ]));
            expect(policy.queryVolunteer(99)).toBeUndefined();

            // Crew: participation:read grants phone number and note read, not note update.
            expect(policy.queryVolunteer(1)).toEqual({
                level: 'full',
                isSelf: false,
                visibleTeamIds: new Set([ kTeamCrew.id ]),
                canEditAvatar: false,
                canViewPhoneNumber: true,
                readableNoteTeamIds: new Set([ kTeamCrew.id ]),
                editableNoteTeamIds: new Set(),
            });

            // Stewards: schedules:read grants directory visibility, not notes or non-leader phone.
            expect(policy.queryVolunteer(2)).toEqual({
                level: 'full',
                isSelf: false,
                visibleTeamIds: new Set([ kTeamStewards.id ]),
                canEditAvatar: false,
                canViewPhoneNumber: false,
                readableNoteTeamIds: new Set(),
                editableNoteTeamIds: new Set(),
            });

            // Hosts: grant was for a different event, so invisible.
            expect(policy.queryVolunteer(3)).toBeUndefined();
        });

        it('grants full access to global administrators and honours revokes', () => {
            const access = new AccessControl({
                grants: [
                    'volunteers.participation',
                    'organisation.avatars',
                ],
                revokes: [
                    { permission: 'volunteers.participation', event: kEventSlug, team: 'hosts' },
                ],
                events: kAnyEvent,
                teams: kAnyTeam,
            });

            const policy = createPolicy({
                viewerUserId: 99,
                access,
                participations: [
                    { userId: 1, teamId: kTeamCrew.id, isLeader: false },
                    { userId: 2, teamId: kTeamHosts.id, isLeader: false },
                ],
            });

            expect(policy.visibleTeams).toEqual(
                new Set([ kTeamCrew.id, kTeamCrewCare.id, kTeamStewards.id ]));
            expect(policy.canSeeTeam('hosts')).toBe(false);
            expect(policy.queryVolunteer(2)).toBeUndefined();

            expect(policy.queryVolunteer(1)).toEqual({
                level: 'full',
                isSelf: false,
                visibleTeamIds: new Set([ kTeamCrew.id ]),
                canEditAvatar: true,
                canViewPhoneNumber: true,
                readableNoteTeamIds: new Set([ kTeamCrew.id ]),
                editableNoteTeamIds: new Set([ kTeamCrew.id ]),
            });
        });
    });

    describe('shared-shift and exact-touching handoff visibility', () => {
        it('matches shared shiftId or activityId with overlap and exact-touching handoffs', () => {
            const policy = createPolicy({
                viewerUserId: 1,
                participations: [
                    { userId: 1, teamId: kTeamCrew.id, isLeader: false },
                    { userId: 2, teamId: kTeamStewards.id, isLeader: false },
                    { userId: 3, teamId: kTeamStewards.id, isLeader: true },
                    { userId: 4, teamId: kTeamHosts.id, isLeader: false },
                    { userId: 5, teamId: kTeamHosts.id, isLeader: false },
                    { userId: 6, teamId: kTeamHosts.id, isLeader: false },
                ],
                shifts: [
                    // Viewer: 12:00-15:00 on shift 50 (activity 500)
                    {
                        scheduleId: 100,
                        userId: 1,
                        shiftId: 50,
                        shiftTeamId: kTeamCrew.id,
                        activityId: 500,
                        startMs: hour(12),
                        endMs: hour(15),
                    },
                    // Viewer's own back-to-back shift: 15:00-17:00 (must not self-match)
                    {
                        scheduleId: 101,
                        userId: 1,
                        shiftId: 50,
                        shiftTeamId: kTeamCrew.id,
                        activityId: 500,
                        startMs: hour(15),
                        endMs: hour(17),
                    },
                    // Outgoing handoff: 09:00-12:00 on same shiftId
                    {
                        scheduleId: 201,
                        userId: 2,
                        shiftId: 50,
                        shiftTeamId: kTeamCrew.id,
                        activityId: 500,
                        startMs: hour(9),
                        endMs: hour(12),
                    },
                    // Incoming handoff: 15:00-18:00 on different shiftId, same activityId (leader)
                    {
                        scheduleId: 202,
                        userId: 3,
                        shiftId: 60,
                        shiftTeamId: kTeamStewards.id,
                        activityId: 500,
                        startMs: hour(15),
                        endMs: hour(18),
                    },
                    // Overlapping colleague: 13:00-14:00 on different shiftId, same activityId
                    {
                        scheduleId: 203,
                        userId: 4,
                        shiftId: 60,
                        shiftTeamId: kTeamStewards.id,
                        activityId: 500,
                        startMs: hour(13),
                        endMs: hour(14),
                    },
                    // Non-touching gap (starts 1ms after viewer ends): must NOT match
                    {
                        scheduleId: 204,
                        userId: 5,
                        shiftId: 50,
                        shiftTeamId: kTeamCrew.id,
                        activityId: 500,
                        startMs: hour(17) + 1,
                        endMs: hour(19),
                    },
                    // Unrelated shift for colleague 4 on another day: must stay hidden
                    {
                        scheduleId: 205,
                        userId: 4,
                        shiftId: 70,
                        shiftTeamId: kTeamHosts.id,
                        activityId: 501,
                        startMs: hour(20),
                        endMs: hour(22),
                    },
                    // Different shift and activity at overlapping time: must NOT match
                    {
                        scheduleId: 206,
                        userId: 6,
                        shiftId: 80,
                        shiftTeamId: kTeamHosts.id,
                        activityId: 502,
                        startMs: hour(12),
                        endMs: hour(15),
                    },
                ],
            });

            // Out-of-team shifts do not expose their teams in the directory.
            expect([ ...policy.visibleTeams ]).toEqual([ kTeamCrew.id ]);

            // Colleagues relative to viewer's 12:00-15:00 shift (100):
            expect(policy.queryShiftColleagues(100)).toEqual({
                outgoing: [ 201 ],
                overlapping: [ 203 ],
                incoming: [ 202 ],
            });

            // Relative to viewer's 15:00-17:00 shift (101), shift 202 (15:00-18:00) overlaps:
            expect(policy.queryShiftColleagues(101)).toEqual({
                outgoing: [],
                overlapping: [ 202 ],
                incoming: [],
            });

            // Unknown or non-viewer schedule IDs return empty groupings.
            expect(policy.queryShiftColleagues(201)).toEqual({
                outgoing: [],
                overlapping: [],
                incoming: [],
            });

            // Regular shared-shift colleague gets restricted profile without phone number.
            expect(policy.queryVolunteer(2)).toEqual({
                level: 'shared-shift',
                isSelf: false,
                canEditAvatar: false,
                canViewPhoneNumber: false,
            });
            expect(policy.requireVolunteer(2).level).toBe('shared-shift');

            // Leader shared-shift colleague gets restricted profile with phone number visible.
            expect(policy.queryVolunteer(3)).toEqual({
                level: 'shared-shift',
                isSelf: false,
                canEditAvatar: false,
                canViewPhoneNumber: true,
            });

            // Only matched shifts are visible; colleague 4's unrelated shift stays hidden.
            expect(policy.canSeeShift(201)).toBe(true);
            expect(policy.canSeeShift(202)).toBe(true);
            expect(policy.canSeeShift(203)).toBe(true);
            expect(policy.canSeeShift(204)).toBe(false);
            expect(policy.canSeeShift(205)).toBe(false);
            expect(policy.canSeeShift(206)).toBe(false);

            // Non-touching / unrelated volunteers remain invisible.
            expect(policy.queryVolunteer(5)).toBeUndefined();
            expect(policy.queryVolunteer(6)).toBeUndefined();
        });

        it('matches internal shifts only by shiftId and ignores non-participants', () => {
            const policy = createPolicy({
                viewerUserId: 1,
                participations: [
                    { userId: 1, teamId: kTeamCrew.id, isLeader: false },
                    { userId: 2, teamId: kTeamStewards.id, isLeader: false },
                    { userId: 3, teamId: kTeamHosts.id, isLeader: false },
                    // userId 4 is deliberately absent (cancelled/non-accepted)
                ],
                shifts: [
                    {
                        scheduleId: 100,
                        userId: 1,
                        shiftId: 50,
                        shiftTeamId: kTeamCrew.id,
                        startMs: hour(10),
                        endMs: hour(12),
                    },
                    // Same internal shiftId: matches
                    {
                        scheduleId: 201,
                        userId: 2,
                        shiftId: 50,
                        shiftTeamId: kTeamCrew.id,
                        startMs: hour(12),
                        endMs: hour(14),
                    },
                    // Different internal shiftId, both activityId undefined: must NOT match
                    {
                        scheduleId: 202,
                        userId: 3,
                        shiftId: 51,
                        shiftTeamId: kTeamHosts.id,
                        startMs: hour(10),
                        endMs: hour(12),
                    },
                    // Orphaned schedule row for a non-accepted user: must NOT leak
                    {
                        scheduleId: 203,
                        userId: 4,
                        shiftId: 50,
                        shiftTeamId: kTeamCrew.id,
                        startMs: hour(10),
                        endMs: hour(12),
                    },
                ],
            });

            expect(policy.queryShiftColleagues(100)).toEqual({
                outgoing: [],
                overlapping: [],
                incoming: [ 201 ],
            });
            expect(policy.queryVolunteer(2)?.level).toBe('shared-shift');
            expect(policy.queryVolunteer(3)).toBeUndefined();
            expect(policy.queryVolunteer(4)).toBeUndefined();
            expect(policy.canSeeShift(202)).toBe(false);
            expect(policy.canSeeShift(203)).toBe(false);
        });
    });

    describe('multi-team volunteers and borrowed shifts', () => {
        it('isolates hidden team memberships and shifts for multi-team volunteers', () => {
            const policy = createPolicy({
                viewerUserId: 1,
                access: new AccessControl({
                    grants: [
                        { permission: 'volunteers.participation', event: kEventSlug, team: 'crew' },
                    ],
                }),
                participations: [
                    { userId: 1, teamId: kTeamCrew.id, isLeader: true },
                    // Multi-team volunteer: regular in Crew, leader in Stewards
                    { userId: 2, teamId: kTeamCrew.id, isLeader: false },
                    { userId: 2, teamId: kTeamStewards.id, isLeader: true },
                    // Single-team volunteer: only in Crew
                    { userId: 3, teamId: kTeamCrew.id, isLeader: false },
                ],
                shifts: [
                    // Viewer's shift overlapping one of user 2's Stewards shifts
                    {
                        scheduleId: 100,
                        userId: 1,
                        shiftId: 50,
                        shiftTeamId: kTeamCrew.id,
                        activityId: 500,
                        startMs: hour(10),
                        endMs: hour(12),
                    },
                    // User 2's Crew shift: visible
                    {
                        scheduleId: 201,
                        userId: 2,
                        shiftId: 51,
                        shiftTeamId: kTeamCrew.id,
                        startMs: hour(14),
                        endMs: hour(16),
                    },
                    // User 2's Stewards shift (not overlapping viewer): hidden (hidden 2nd team)
                    {
                        scheduleId: 202,
                        userId: 2,
                        shiftId: 52,
                        shiftTeamId: kTeamStewards.id,
                        startMs: hour(16),
                        endMs: hour(18),
                    },
                    // User 2's Stewards shift (overlapping viewer on activity 500): visible
                    {
                        scheduleId: 203,
                        userId: 2,
                        shiftId: 53,
                        shiftTeamId: kTeamStewards.id,
                        activityId: 500,
                        startMs: hour(11),
                        endMs: hour(13),
                    },
                    // User 3 (Crew only) borrowed onto a Stewards-owned Briefing shift: visible
                    {
                        scheduleId: 301,
                        userId: 3,
                        shiftId: 54,
                        shiftTeamId: kTeamStewards.id,
                        startMs: hour(9),
                        endMs: hour(10),
                    },
                ],
            });

            expect(policy.queryVolunteer(2)).toEqual({
                level: 'full',
                isSelf: false,
                visibleTeamIds: new Set([ kTeamCrew.id ]),
                canEditAvatar: false,
                canViewPhoneNumber: true,  // viewer has participation:read on Crew
                readableNoteTeamIds: new Set([ kTeamCrew.id ]),
                editableNoteTeamIds: new Set([ kTeamCrew.id ]),
            });

            expect(policy.canSeeShift(201)).toBe(true);
            expect(policy.canSeeShift(202)).toBe(false);
            expect(policy.canSeeShift(203)).toBe(true);
            expect(policy.canSeeShift(301)).toBe(true);
        });

        it('does not expose phone number from a leader role in a hidden team', () => {
            const policy = createPolicy({
                viewerUserId: 1,
                participations: [
                    { userId: 1, teamId: kTeamCrew.id, isLeader: false },
                    { userId: 2, teamId: kTeamCrew.id, isLeader: false },
                    { userId: 2, teamId: kTeamStewards.id, isLeader: true },
                ],
            });

            expect(policy.queryVolunteer(2)).toEqual({
                level: 'full',
                isSelf: false,
                visibleTeamIds: new Set([ kTeamCrew.id ]),
                canEditAvatar: false,
                canViewPhoneNumber: false,
                readableNoteTeamIds: new Set(),
                editableNoteTeamIds: new Set(),
            });
        });
    });
});
