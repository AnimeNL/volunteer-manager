// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { ProgramIndex, type ProgramSlice } from './ProgramIndex';

import { kActivityType } from '@lib/database/Types';

const kSampleSlice: ProgramSlice = {
    areas: [
        { id: 1, name: 'Main Building', type: kActivityType.Program },
        { id: 2, name: 'Event Hall', type: kActivityType.Program },
        { id: 3, name: 'Backstage', type: kActivityType.Internal },
    ],
    locations: [
        { id: 10, areaId: 1, name: 'Theater', type: kActivityType.Program },
        { id: 11, areaId: 1, name: 'Atrium', type: kActivityType.Program },
        { id: 20, areaId: 2, name: 'Dealer Room', type: kActivityType.Program },
        { id: 30, areaId: 3, name: 'Volunteer Lounge', type: kActivityType.Internal },
    ],
    activities: [
        { id: 100, title: 'Opening Ceremony', type: kActivityType.Program, visible: true },
        { id: 101, title: 'Secret Rehearsal', type: kActivityType.Program, visible: false },
        { id: 102, title: 'Dealer Hall Open', type: kActivityType.Program, visible: true },
        {
            id: 200,
            title: 'Crew Briefing',
            type: kActivityType.Internal,
            visible: false,
            locationId: 30,
        },
    ],
    timeslots: [
        { id: 1000, activityId: 100, locationId: 10, startMs: 1000, endMs: 2000 },
        { id: 1001, activityId: 101, locationId: 11, startMs: 1500, endMs: 2500 },
        { id: 1002, activityId: 102, locationId: 20, startMs: 1000, endMs: 5000 },
        { id: 1003, activityId: 200, locationId: 30, startMs: 500, endMs: 1200 },
    ],
};

describe('ProgramIndex', () => {
    it('sorts areas and locations alphabetically and separates program-only views', () => {
        const index = new ProgramIndex(kSampleSlice);

        expect(index.getAreas().map(area => area.name)).toEqual([
            'Backstage', 'Event Hall', 'Main Building',
        ]);
        expect(index.getAreas({ programOnly: true }).map(area => area.name)).toEqual([
            'Event Hall', 'Main Building',
        ]);
        expect(index.getLocations(1).map(location => location.name)).toEqual([
            'Atrium', 'Theater',
        ]);
        expect(index.getActivityLocationId(200)).toBe(30);
    });

    it('queries active timeslots by area, location, type, and visibility', () => {
        const index = new ProgramIndex(kSampleSlice);

        expect(index.getActiveTimeslotsAt(1600).map(slot => slot.id)).toEqual([
            1000, 1002, 1001,
        ]);
        expect(index.getActiveTimeslotsAt(1600, { areaId: 1 }).map(slot => slot.id)).toEqual([
            1000, 1001,
        ]);
        expect(
            index.getActiveTimeslotsAt(1600, { areaId: 1, includeHidden: false })
                .map(slot => slot.id),
        ).toEqual([ 1000 ]);
        expect(
            index.getActiveTimeslotsAt(1100, { programOnly: true }).map(slot => slot.id),
        ).toEqual([ 1000, 1002 ]);
        expect(index.getActiveTimeslotsAt(1100, { locationId: 30 }).map(slot => slot.id)).toEqual([
            1003,
        ]);
    });

    it('returns sorted activity timeslots and next transition boundaries', () => {
        const index = new ProgramIndex(kSampleSlice);

        expect(index.getTimeslotsForLocation(10).map(slot => slot.id)).toEqual([ 1000 ]);
        expect(index.getTimeslotsForActivity(100).map(slot => slot.id)).toEqual([ 1000 ]);
        expect(index.getNextTransitionAfter(1000)).toBe(1200);
        expect(index.getNextTransitionAfter(5000)).toBeUndefined();
    });
});
