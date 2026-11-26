// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { ScheduleListRowState } from '../../components/ScheduleList';

/**
 * Mocked program area summary for the Areas index page.
 */
interface MockProgramAreaSummary {
    id: number;
    locationsCount: number;
    locationsSummary: string;
    name: string;
}

/**
 * Mocked scheduled program event row shared between Area and Location detail views.
 */
interface MockProgramEvent {
    hidden?: boolean;
    id: number;
    progress?: number;
    state: ScheduleListRowState;
    time: string;
    title: string;
}

/**
 * Mocked location grouping displayed on the Area detail page.
 */
interface MockProgramLocation {
    events: MockProgramEvent[];
    id: number;
    name: string;
}

/**
 * Mocked day grouping displayed on the Location detail page.
 */
interface MockProgramDayGroup {
    events: MockProgramEvent[];
    isPast: boolean;
    label: string;
}

/**
 * Temporary mocked list of program areas until the real program data model is wired up.
 */
export const kMockProgramAreas: MockProgramAreaSummary[] = [
    {
        id: 1,
        locationsCount: 4,
        locationsSummary: 'Bag room, Dressing Rooms, Events 4, Signings Area',
        name: 'Bakkerij 1',
    },
    {
        id: 2,
        locationsCount: 3,
        locationsSummary: 'Main Stage, Backstage, Green Room',
        name: 'Bakkerij 2',
    },
    {
        id: 3,
        locationsCount: 2,
        locationsSummary: 'Registration Desk, Info Booth',
        name: 'Entrance area',
    },
    {
        id: 4,
        locationsCount: 3,
        locationsSummary: 'Dealer Hall, Artist Alley, Wardrobe',
        name: 'Passage',
    },
    {
        id: 5,
        locationsCount: 2,
        locationsSummary: 'Courtyard Stage, Food Plaza',
        name: 'Terrace',
    },
];

/**
 * Temporary mocked locations and condensed events for the Area detail page.
 */
const kMockAreaLocations: MockProgramLocation[] = [
    {
        id: 101,
        name: 'Bag room',
        events: [
            {
                id: 1001,
                progress: 42,
                state: 'active',
                time: 'until 02:00',
                title: 'Bag Room & Lockers',
            },
            {
                id: 1002,
                state: 'default',
                time: 'Sun, 10:00–19:00',
                title: 'Bag Room & Lockers',
            },
        ],
    },
    {
        id: 102,
        name: 'Dressing Rooms',
        events: [
            {
                id: 1003,
                progress: 42,
                state: 'active',
                time: 'until 02:00',
                title: 'Dressing Rooms',
            },
            {
                id: 1004,
                state: 'default',
                time: 'Sun, 10:00–19:00',
                title: 'Dressing Rooms',
            },
        ],
    },
    {
        id: 103,
        name: 'Events 4',
        events: [
            {
                id: 1005,
                progress: 68,
                state: 'active',
                time: 'until 14:30',
                title: 'Traditional Japanese cooking',
            },
            {
                hidden: true,
                id: 1006,
                state: 'default',
                time: 'Sun, 10:30–12:00',
                title: 'DORAYAKI Workshop',
            },
            {
                hidden: true,
                id: 1007,
                state: 'default',
                time: 'Sun, 12:30–14:00',
                title: 'Design your own Japanese Tenugui towel with Indigo Discharge (Bassen)',
            },
        ],
    },
    {
        id: 104,
        name: 'Signings Area',
        events: [
            {
                id: 1008,
                progress: 55,
                state: 'active',
                time: 'until 18:00',
                title: 'Lucius Merryweather - Signing / Meet & Greet',
            },
            {
                id: 1009,
                progress: 55,
                state: 'active',
                time: 'until 18:00',
                title: 'Lumi - Signing / Meet & Greet',
            },
            {
                hidden: true,
                id: 1010,
                state: 'default',
                time: '21:00–22:30',
                title: 'Maki Otsuki - Signing / Meet & Greet',
            },
        ],
    },
];

/**
 * Temporary mocked day-grouped schedule for the Location detail page.
 */
const kMockLocationDays: MockProgramDayGroup[] = [
    {
        isPast: false,
        label: 'Saturday',
        events: [
            {
                id: 1008,
                progress: 55,
                state: 'active',
                time: '10:00–18:00',
                title: 'Lucius Merryweather - Signing / Meet & Greet',
            },
            {
                id: 1009,
                progress: 55,
                state: 'active',
                time: '10:00–18:00',
                title: 'Lumi - Signing / Meet & Greet',
            },
            {
                hidden: true,
                id: 1010,
                state: 'default',
                time: '21:00–22:30',
                title: 'Maki Otsuki - Signing / Meet & Greet',
            },
        ],
    },
    {
        isPast: false,
        label: 'Sunday',
        events: [
            {
                id: 1011,
                state: 'default',
                time: '10:00–17:00',
                title: 'Lucius Merryweather - Signing / Meet & Greet',
            },
            {
                id: 1012,
                state: 'default',
                time: '10:00–17:00',
                title: 'Lumi - Signing / Meet & Greet',
            },
        ],
    },
    {
        isPast: true,
        label: 'Friday',
        events: [
            {
                id: 1013,
                state: 'past',
                time: '14:00–20:00',
                title: 'Lucius Merryweather - Signing / Meet & Greet',
            },
            {
                id: 1014,
                state: 'past',
                time: '14:00–20:00',
                title: 'Lumi - Signing / Meet & Greet',
            },
            {
                hidden: true,
                id: 1015,
                state: 'past',
                time: '21:00–22:30',
                title: 'Maki Otsuki - Signing / Meet & Greet',
            },
        ],
    },
];

/**
 * Returns mocked area details for `areaParam`, falling back to Bakkerij 1 so any sidebar area link
 * renders a complete preview.
 */
export function getMockAreaDetail(areaParam: string) {
    const areaId = Number(areaParam);
    const matched = kMockProgramAreas.find(area => area.id === areaId) ?? kMockProgramAreas[0];

    return {
        description: `${kMockAreaLocations.length} locations in this area`,
        locations: kMockAreaLocations,
        name: matched.name,
    };
}

/**
 * Returns mocked location details for `locationParam`, falling back to Signings Area.
 */
export function getMockLocationDetail(locationParam: string) {
    const locationId = Number(locationParam);
    const matched =
        kMockAreaLocations.find(location => location.id === locationId) ?? kMockAreaLocations[3];

    return {
        areaName: 'Bakkerij 1',
        days: kMockLocationDays,
        name: matched.name,
    };
}
