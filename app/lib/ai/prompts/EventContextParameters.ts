// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Parameters relaying context about the event that's in scope.
 */
export type EventContextParameters = {
    event: {
        endTime: string;
        location?: string;
        name: string;
        shortName: string;
        slug: string;
        startTime: string;
    };
};

/**
 * Example parameters that convey information about a particular event that's in context.
 */
export const kEventContextExampleParameters: EventContextParameters = {
    event: {
        endTime: '2026-04-19 20:00:00',
        location: 'De Broodfabriek, Rijswijk',
        name: 'AnimeCon 2026: Hidden Spirits',
        shortName: 'AnimeCon 2026',
        slug: '2026',
        startTime: '2026-04-17 14:00:00',
    },
};
