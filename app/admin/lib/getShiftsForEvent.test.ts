// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { getShiftsForEvent } from './getShiftsForEvent';
import { useMockConnection } from '@lib/database/Connection';

describe('getShiftsForEvent', () => {
    const mockConnection = useMockConnection();

    it('should resolve shift colours within a category given a gradient (1 entry)', async () => {
        mockConnection.expect('selectManyRows', () => ([
            {
                id: 1,
                category: {
                    colour: '#000000,#ffffff',
                    countContribution: 1,
                    name: 'My category',
                },
                name: 'My shift',
                team: {
                    id: 1,
                    color: '#ff0000',
                    name: 'Crew',
                    slug: 'crew',
                },
                activity: undefined,
                // TODO: requested
                // TODO: scheduled
                excitement: 0.5,
            }
        ]));

        const shifts = await getShiftsForEvent(/* eventId= */ 100, /* festivalId= */ 600);
        expect(shifts).toHaveLength(1);

        expect(shifts[0].colour).toBe('rgb(178, 178, 178)');
    });

    it('should resolve shift colours within a category given a gradient (3 entries)', async () => {
        const shiftTemplate = {
            category: {
                colour: '#000000,#ffffff',
                countContribution: 1,
                name: 'My category',
            },
            team: {
                id: 1,
                color: '#ff0000',
                name: 'Crew',
                slug: 'crew',
            },
            activity: undefined,
            // TODO: requested
            // TODO: scheduled
            excitement: 0.5,
        };

        mockConnection.expect('selectManyRows', () => ([
            { ...shiftTemplate, id: 1, name: 'First shift' },
            { ...shiftTemplate, id: 2, name: 'Second shift' },
            { ...shiftTemplate, id: 3, name: 'Third shift' },
        ]));

        const shifts = await getShiftsForEvent(/* eventId= */ 100, /* festivalId= */ 600);
        expect(shifts).toHaveLength(3);

        expect(shifts[0].colour).toBe('rgb(51, 51, 51)');
        expect(shifts[1].colour).toBe('rgb(128, 128, 128)');
        expect(shifts[2].colour).toBe('rgb(204, 204, 204)');
    });

    it('should resolve shift colours within a category given a gradient (5 entries)', async () => {
        const shiftTemplate = {
            category: {
                colour: '#000000,#ffffff',
                countContribution: 1,
                name: 'My category',
            },
            team: {
                id: 1,
                color: '#ff0000',
                name: 'Crew',
                slug: 'crew',
            },
            activity: undefined,
            // TODO: requested
            // TODO: scheduled
            excitement: 0.5,
        };

        mockConnection.expect('selectManyRows', () => ([
            { ...shiftTemplate, id: 1, name: 'First shift' },
            { ...shiftTemplate, id: 2, name: 'Second shift' },
            { ...shiftTemplate, id: 3, name: 'Third shift' },
            { ...shiftTemplate, id: 4, name: 'Fourth shift' },
            { ...shiftTemplate, id: 5, name: 'Fifth shift' },
        ]));

        const shifts = await getShiftsForEvent(/* eventId= */ 100, /* festivalId= */ 600);
        expect(shifts).toHaveLength(5);

        expect(shifts[0].colour).toBe('rgb(0, 0, 0)');
        expect(shifts[1].colour).toBe('rgb(64, 64, 64)');
        expect(shifts[2].colour).toBe('rgb(128, 128, 128)');
        expect(shifts[3].colour).toBe('rgb(191, 191, 191)');
        expect(shifts[4].colour).toBe('rgb(255, 255, 255)');
    });

    it('should consider the team a shift is assigned to when given a gradient', async () => {
        const kCrew = { id: 1, color: '#ff0000', name: 'Crew', slug: 'crew' };
        const kHosts = { id: 2, color: '#00ff00', name: 'Hosts', slug: 'hosts' };

        const shiftTemplate = {
            category: {
                colour: '#000000,#ffffff',
                countContribution: 1,
                name: 'My category',
            },
            activity: undefined,
            // TODO: requested
            // TODO: scheduled
            excitement: 0.5,
        };

        mockConnection.expect('selectManyRows', () => ([
            { ...shiftTemplate, id: 1, name: 'First shift', team: kCrew },
            { ...shiftTemplate, id: 2, name: 'Second shift', team: kCrew },
            { ...shiftTemplate, id: 3, name: 'Third shift', team: kCrew },
            { ...shiftTemplate, id: 4, name: 'Fourth shift', team: kHosts },
            { ...shiftTemplate, id: 5, name: 'Fifth shift', team: kHosts },
            { ...shiftTemplate, id: 6, name: 'Sixth shift', team: kHosts },
        ]));

        const shifts = await getShiftsForEvent(/* eventId= */ 100, /* festivalId= */ 600);
        expect(shifts).toHaveLength(6);

        expect(shifts[0].colour).toBe(shifts[3].colour);
        expect(shifts[1].colour).toBe(shifts[4].colour);
        expect(shifts[2].colour).toBe(shifts[5].colour);
    });

    it('should resolve shift colours within a shift category, given a fixed colour', async () => {
        const shiftTemplate = {
            category: {
                colour: '#ff00ff',
                countContribution: 1,
                name: 'My category',
            },
            team: {
                id: 1,
                color: '#ff0000',
                name: 'Crew',
                slug: 'crew',
            },
            activity: undefined,
            // TODO: requested
            // TODO: scheduled
            excitement: 0.5,
        };

        mockConnection.expect('selectManyRows', () => ([
            { ...shiftTemplate, id: 1, name: 'First shift' },
            { ...shiftTemplate, id: 2, name: 'Second shift' },
        ]));

        const shifts = await getShiftsForEvent(/* eventId= */ 100, /* festivalId= */ 600);
        expect(shifts).toHaveLength(2);

        expect(shifts[0].colour).toBe('rgb(255, 0, 255)');
        expect(shifts[1].colour).toBe('rgb(255, 0, 255)');
    });
});
