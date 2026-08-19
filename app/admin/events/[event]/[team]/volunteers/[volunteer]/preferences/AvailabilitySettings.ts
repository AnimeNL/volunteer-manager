// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

/**
 * Scheme definition for valid build-up / tear-down information as stored in the database.
 */
export const kAvailabilityBuildUpTearDownScheme = z.object({
    buildUpDayBefore: z.string(),
    buildUpOpening: z.string(),
    tearDownClosing: z.string(),
    tearDownDayAfter: z.string(),
});

/**
 * States that are valid for the availability timeline.
 */
type ValidStates = 'available' | 'avoid' | 'unavailable';

/**
 * Colours to use in the <AvailabilityTimeline> component.
 */
export const kAvailabilityTimelineColours: { [k in ValidStates]: string } = {
    available: '#2E7D32',
    avoid: '#FFC107',
    unavailable: '#37474F',
};

/**
 * Titles to use in the <AvailabilityTimelineImpl> component.
 */
export const kAvailabilityTimelineTitles: { [k in ValidStates]: string } = {
    available: 'Available',
    avoid: 'Avoid',
    unavailable: 'Unavailable',
};

/**
 * Options that can be chosen in the availability exception configuration dialog.
 */
export const kExceptionTypeOptions = [
    { id: 'available', label: 'Available for shifts' },
    { id: 'avoid', label: 'Avoid shifts' },
    { id: 'unavailable', label: 'Unavailable for shifts' },
];

/**
 * Number of hours that the volunteer would like to help us out with.
 */
export const kServiceHoursProperty = z.literal([ 12, 16, 20, 24 ]);

/**
 * Timing of the shifts the volunteer would like to fulfill.
 */
export const kServiceTimingProperty = z.literal([ '8-20', '10-0', '14-3' ]);

type ServiceHourValues = z.TypeOf<typeof kServiceHoursProperty>;
type ServiceTimingValues = z.TypeOf<typeof kServiceTimingProperty>;

/**
 * Valid options for the number of hours volunteers are willing to work. When updating an ID, make
 * sure that `kDefaultValues` is updated as well.
 */
export const kServiceHoursOptions: { id: ServiceHourValues, label: string }[] = [
    { id: 12, label: 'Up to 12 hours' },
    { id: 16, label: '12–16 hours' },
    { id: 20, label: '16–20 hours' },
    { id: 24, label: 'More than 20 hours' },
];

/**
 * Valid options for the timing of shifts a volunteer could be issued. When updating an ID, make
 * sure that `kDefaultValues` is updated as well.
 */
export const kServiceTimingOption: { id: ServiceTimingValues, label: string }[] = [
    { id: '8-20', label: 'Early (08:00–20:00)' },
    { id: '10-0', label: 'Regular (10:00–00:00)' },
    { id: '14-3', label: 'Late (14:00–03:00)' },
];
