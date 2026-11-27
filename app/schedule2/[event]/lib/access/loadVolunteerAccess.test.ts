// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { AccessControl } from '@lib/auth/access';
import { getVolunteerAccess } from './loadVolunteerAccess';
import { useMockConnection } from '@lib/database/Connection';

vi.mock('next/cache', () => ({
    cacheLife: vi.fn(),
    cacheTag: vi.fn(),
}));

describe('loadVolunteerAccess', () => {
    const mockConnection = useMockConnection();

    it('loads cached visibility edges and event snapshot into VolunteerAccess', async () => {
        mockConnection.expect('selectManyRows', () => [
            { teamId: 2, visibleTeamId: 1 },  // Crew Care -> Crew
        ]);
        mockConnection.expect('selectManyRows', () => [
            { id: 1, slug: 'crew' },
            { id: 2, slug: 'crew-care' },
            { id: 3, slug: 'stewards' },
        ]);
        mockConnection.expect('selectManyRows', () => [
            { userId: 10, teamId: 2, isLeader: 0 },
            { userId: 20, teamId: 1, isLeader: 1 },
            { userId: 30, teamId: 3, isLeader: 0 },
        ]);
        mockConnection.expect('selectManyRows', () => [
            {
                scheduleId: 100,
                userId: 10,
                shiftId: 50,
                shiftTeamId: 2,
                activityId: 500,
                start: '2026-06-06 12:00:00',
                end: '2026-06-06 15:00:00',
            },
            {
                scheduleId: 101,
                userId: 30,
                shiftId: 60,
                shiftTeamId: 3,
                activityId: 500,
                start: '2026-06-06 15:00:00',
                end: '2026-06-06 18:00:00',
            },
        ]);

        const policy = await getVolunteerAccess({
            access: new AccessControl({}),
            event: { id: 7, slug: '2026' },
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

        // Out-of-team volunteer taking over at 15:00 on the same activity:
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
});
