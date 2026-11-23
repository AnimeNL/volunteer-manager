// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { useMockConnection } from '@lib/database/Connection';

import { compileDateWarnings } from './compileDateWarnings';

describe('compileDateWarnings', () => {
    const mockConnection = useMockConnection();

    it('returns an empty list without querying participants when there are no bookings', async () => {
        mockConnection.expect('selectManyRows', () => []);

        const warnings = await compileDateWarnings(42);
        expect(warnings).toEqual([]);
    });

    it('produces no warnings when booked nights match preferences and ignores external guests', async () => {
        mockConnection.expect('selectManyRows', () => [
            {
                checkIn: '2026-06-12',   // Friday
                checkOut: '2026-06-14',  // Sunday (Fri + Sat nights)
                firstUserId: 10,
                firstName: 'Alice',
                secondUserId: null,
                secondName: 'External Guest',
                thirdUserId: null,
                thirdName: null,
            },
        ]);
        mockConnection.expect('selectManyRows', () => [
            {
                userId: 10,
                checkIn: '2026-06-12',
                checkOut: '2026-06-14',
            },
        ]);

        const warnings = await compileDateWarnings(42);
        expect(warnings).toEqual([]);
    });

    it('detects non-participating assignees, duplicate nights, excess nights, and missing nights', async () => {
        mockConnection.expect('selectManyRows', () => [
            {
                // Charlie: Fri + Sat booked, but not in participants -> non-participating
                checkIn: '2026-06-12',
                checkOut: '2026-06-14',
                firstUserId: 30,
                firstName: 'Charlie',
                secondUserId: null,
                secondName: null,
                thirdUserId: null,
                thirdName: null,
            },
            {
                // Alice: Fri + Sat booked in room 1, plus Sat in room 2 -> duplicate Saturday,
                // excess Friday (only requested Sat + Sun -> missing Sunday)
                checkIn: '2026-06-12',
                checkOut: '2026-06-14',
                firstUserId: 10,
                firstName: 'Alice',
                secondUserId: null,
                secondName: null,
                thirdUserId: null,
                thirdName: null,
            },
            {
                checkIn: '2026-06-13',
                checkOut: '2026-06-14',
                firstUserId: null,
                firstName: null,
                secondUserId: 10,
                secondName: 'Alice',
                thirdUserId: null,
                thirdName: null,
            },
        ]);

        mockConnection.expect('selectManyRows', () => [
            {
                userId: 10,
                checkIn: '2026-06-13',   // Saturday
                checkOut: '2026-06-15',  // Monday (Sat + Sun nights)
            },
        ]);

        const warnings = await compileDateWarnings(42);
        expect(warnings).toEqual([
            {
                volunteer: 'Alice',
                warning: 'is assigned to multiple rooms on Saturday.',
            },
            {
                volunteer: 'Alice',
                warning: 'is assigned a room that they didn\'t request on Friday.',
            },
            {
                volunteer: 'Alice',
                warning: 'requested a room on Sunday that hasn\'t been booked.',
            },
            {
                volunteer: 'Charlie',
                warning: 'is assigned to a booking, but is no longer participating.',
            },
        ]);
    });
});
