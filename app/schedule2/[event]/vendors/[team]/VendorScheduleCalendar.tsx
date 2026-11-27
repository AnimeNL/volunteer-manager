// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useMemo } from 'react';

import type { SchedulerEvent, SchedulerEventColor, SchedulerResource }
    from '@mui/x-scheduler-premium/models';
import Box from '@mui/material/Box';
import { StandaloneCompactThreeDayViewPremium }
    from '@mui/x-scheduler-premium/compact-three-day-view-premium';

import type { VendorScheduleMember, VendorScheduleShift } from '../../lib/data/vendorData';

import { kVendorCalendarHeightPx } from '../../lib/vendorMetadata';

/**
 * Distinct MUI scheduler colour palettes cycled across vendor resources.
 */
const kResourceColors: readonly SchedulerEventColor[] = [
    'blue', 'teal', 'purple', 'orange', 'green', 'indigo', 'pink', 'amber', 'red', 'lime',
];

/**
 * Props accepted by the <VendorScheduleCalendar> component.
 */
interface VendorScheduleCalendarProps {
    /**
     * Chronologically sorted vendor shifts to display on the calendar.
     */
    shifts: VendorScheduleShift[];

    /**
     * Event start time as an ISO instant string, anchoring the fixed three-day view (Fri–Sun).
     */
    startDate: string;

    /**
     * IANA timezone of the event in which shift times should be rendered.
     */
    timeZone: string;

    /**
     * Alphabetically sorted vendors participating in this schedule.
     */
    vendors: VendorScheduleMember[];
}

/**
 * Full-size, read-only three-day calendar locked to the event's Friday–Sunday window, displaying
 * all scheduled shifts for a vendor team without a sidebar or freeform date navigation.
 */
export function VendorScheduleCalendar(props: VendorScheduleCalendarProps) {
    const { shifts, startDate, timeZone, vendors } = props;

    const { events, resources, visibleDate } = useMemo(() => {
        const vendorNames = new Map<number, string>();
        const resources: SchedulerResource[] = vendors.map((vendor, index) => {
            vendorNames.set(vendor.id, vendor.name);
            return {
                eventColor: kResourceColors[index % kResourceColors.length],
                id: `${vendor.id}`,
                title: vendor.name,
            };
        });

        const events: SchedulerEvent[] = shifts.map(shift => ({
            end: shift.end,
            id: shift.id,
            resource: `${shift.vendorId}`,
            start: shift.start,
            title: vendorNames.get(shift.vendorId) ?? '',
        }));

        return {
            events,
            resources,
            visibleDate: new Date(startDate),
        };
    }, [ shifts, startDate, vendors ]);

    return (
        <Box sx={{ height: kVendorCalendarHeightPx, width: '100%' }}>
            <StandaloneCompactThreeDayViewPremium
                dateLocale="en-GB"
                displayTimezone={timeZone}
                events={events}
                readOnly
                resources={resources}
                showCurrentTimeIndicator
                sx={{ border: 'none' }}
                visibleDate={visibleDate} />
        </Box>
    );
}
