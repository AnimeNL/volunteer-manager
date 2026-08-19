// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

/**
 * Validates the build-up and tear-down availability data stored in the database.
 */
export const kAvailabilityBuildUpTearDownScheme = z.object({
    buildUpDayBefore: z.string(),
    buildUpOpening: z.string(),
    tearDownClosing: z.string(),
    tearDownDayAfter: z.string(),
});

/**
 * Defines the valid states for the availability timeline.
 */
type ValidStates = 'available' | 'avoid' | 'unavailable';

/**
 * Defines the colors for each availability state in the timeline component.
 */
export const kAvailabilityTimelineColours: { [k in ValidStates]: string } = {
    available: '#2E7D32',
    avoid: '#FFC107',
    unavailable: '#37474F',
};

/**
 * Defines the title labels for each availability state in the timeline component.
 */
export const kAvailabilityTimelineTitles: { [k in ValidStates]: string } = {
    available: 'Available',
    avoid: 'Avoid',
    unavailable: 'Unavailable',
};

/**
 * Defines the options in the availability exception configuration dialog.
 */
export const kExceptionTypeOptions = [
    { id: 'available', label: 'Available for shifts' },
    { id: 'avoid', label: 'Avoid shifts' },
    { id: 'unavailable', label: 'Unavailable for shifts' },
];

/**
 * Validates the requested number of volunteer service hours.
 */
export const kServiceHoursProperty = z.union([
    z.literal(12),
    z.literal(16),
    z.literal(20),
    z.literal(24),
]);

/**
 * Validates the requested shift timing window.
 */
export const kServiceTimingProperty = z.enum([ '8-20', '10-0', '14-3' ]);

type ServiceHourValues = z.TypeOf<typeof kServiceHoursProperty>;
type ServiceTimingValues = z.TypeOf<typeof kServiceTimingProperty>;

/**
 * Options for the number of hours that a volunteer wants to work.
 */
export const kServiceHoursOptions: { id: ServiceHourValues, label: string }[] = [
    { id: 12, label: 'Up to 12 hours' },
    { id: 16, label: '12–16 hours' },
    { id: 20, label: '16–20 hours' },
    { id: 24, label: 'More than 20 hours' },
];

/**
 * Options for the shift timings that a volunteer can select.
 */
export const kServiceTimingOptions: { id: ServiceTimingValues, label: string }[] = [
    { id: '8-20', label: 'Early (08:00–20:00)' },
    { id: '10-0', label: 'Regular (10:00–00:00)' },
    { id: '14-3', label: 'Late (14:00–03:00)' },
];

/**
 * @deprecated Use `kServiceTimingOptions` instead.
 */
export const kServiceTimingOption = kServiceTimingOptions;
