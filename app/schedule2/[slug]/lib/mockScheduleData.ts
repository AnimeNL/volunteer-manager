// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';

/**
 * Mocked summary data returned for the overview page.
 */
interface MockEventSummary {
    activeShift: {
        endTime: string;
        location: string;
        title: string;
    };
    eventName: string;
    slug: string;
    upcomingShift: {
        location: string;
        startTime: string;
        title: string;
    };
}

/**
 * Mocked shift entry displayed on the `/shifts` stub page.
 */
interface MockShift {
    day: string;
    id: string;
    location: string;
    status: 'active' | 'past' | 'upcoming';
    timeRange: string;
    title: string;
}

/**
 * Mocked convention area displayed on the `/areas` stub page.
 */
interface MockArea {
    activeCount: number;
    id: string;
    locations: string[];
    name: string;
}

/**
 * Cached mocked overview loader demonstrating `'use cache'`, `cacheLife()`, and `cacheTag()`.
 */
export async function getMockEventSummary(slug: string): Promise<MockEventSummary> {
    'use cache';
    cacheLife('minutes');
    cacheTag('schedule2-event', `schedule2-event:${slug}`);

    return {
        eventName: `AnimeCon ${slug}`,
        slug,
        activeShift: {
            title: 'Main Stage Crowd Control',
            location: 'Amazon Hall',
            endTime: '14:00',
        },
        upcomingShift: {
            title: 'Information Desk',
            location: 'Atrium Lobby',
            startTime: '16:30',
        },
    };
}

/**
 * Cached mocked shifts loader demonstrating `'use cache'`, `cacheLife()`, and `cacheTag()`.
 */
export async function getMockShifts(slug: string): Promise<MockShift[]> {
    'use cache';
    cacheLife('minutes');
    cacheTag('schedule2-shifts', `schedule2-shifts:${slug}`);

    return [
        {
            id: 'shift-1',
            day: 'Friday',
            title: 'Badge Check-in Desk',
            location: 'Main Entrance',
            timeRange: '09:00 – 11:30',
            status: 'past',
        },
        {
            id: 'shift-2',
            day: 'Friday',
            title: 'Main Stage Crowd Control',
            location: 'Amazon Hall',
            timeRange: '12:00 – 14:00',
            status: 'active',
        },
        {
            id: 'shift-3',
            day: 'Friday',
            title: 'Information Desk',
            location: 'Atrium Lobby',
            timeRange: '16:30 – 19:00',
            status: 'upcoming',
        },
    ];
}

/**
 * Cached mocked areas loader demonstrating `'use cache'`, `cacheLife()`, and `cacheTag()`.
 */
export async function getMockAreas(slug: string): Promise<MockArea[]> {
    'use cache';
    cacheLife('minutes');
    cacheTag('schedule2-areas', `schedule2-areas:${slug}`);

    return [
        {
            id: 'area-main',
            name: 'Main Building',
            activeCount: 3,
            locations: [ 'Amazon Hall', 'Atrium Lobby', 'Dealers Room' ],
        },
        {
            id: 'area-west',
            name: 'West Wing',
            activeCount: 1,
            locations: [ 'Workshop Room A', 'Cosplay Repair Lounge' ],
        },
        {
            id: 'area-outdoor',
            name: 'Festival Grounds',
            activeCount: 0,
            locations: [ 'Courtyard Stage', 'Food Court' ],
        },
    ];
}
