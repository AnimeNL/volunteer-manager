// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useMemo } from 'react';

import type { SchedulerEvent, SchedulerEventColor, SchedulerResource }
    from '@mui/x-scheduler-premium/models';
import Box from '@mui/material/Box';
import { EventCalendarPremium } from '@mui/x-scheduler-premium/event-calendar-premium';
import { styled } from '@mui/material/styles';

import type { VendorScheduleMember, VendorScheduleShift } from '../../lib/data/vendorData';

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
     * Current effective portal time as an ISO instant string, used to focus the calendar on today
     * while the schedule is active.
     */
    currentTime: string;

    /**
     * Chronologically sorted vendor shifts to display on the calendar.
     */
    shifts: VendorScheduleShift[];

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
 * Resolves the initial visible date for the calendar: uses `currentTime` when it falls within the
 * span of scheduled shifts, and otherwise jumps directly to the first scheduled shift.
 */
function resolveDefaultVisibleDate(shifts: VendorScheduleShift[], currentTime: string): Date {
    const nowMs = Date.parse(currentTime);
    if (!shifts.length)
        return new Date(nowMs);

    const earliestStartMs = Date.parse(shifts[0].start);
    let latestEndMs = Date.parse(shifts[0].end);
    for (let index = 1; index < shifts.length; ++index) {
        const endMs = Date.parse(shifts[index].end);
        if (endMs > latestEndMs)
            latestEndMs = endMs;
    }

    if (nowMs >= earliestStartMs && nowMs <= latestEndMs)
        return new Date(nowMs);

    return new Date(earliestStartMs);
}

/**
 * Full-size, read-only MUI `<EventCalendarPremium>` displaying all scheduled shifts for a vendor
 * team, with each vendor represented as a filterable, colour-coded resource.
 */
export function VendorScheduleCalendar(props: VendorScheduleCalendarProps) {
    const { currentTime, shifts, timeZone, vendors } = props;

    const { defaultVisibleDate, events, resources } = useMemo(() => {
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
            defaultVisibleDate: resolveDefaultVisibleDate(shifts, currentTime),
            events,
            resources,
        };
    }, [ currentTime, shifts, vendors ]);

    return (
        <CalendarContainer>
            <EventCalendarPremium
                dateLocale="en-GB"
                defaultView="week"
                defaultVisibleDate={defaultVisibleDate}
                displayTimezone={timeZone}
                events={events}
                readOnly
                resources={resources}
                showCurrentTimeIndicator />
        </CalendarContainer>
    );
}

/**
 * Full-height viewport-aware container giving `<EventCalendarPremium>` an explicit height so its
 * internal time grid and side panel scroll smoothly within the schedule sheet.
 */
const CalendarContainer = styled(Box)(({ theme }) => ({
    height: 'calc(100dvh - 230px)',
    minHeight: 540,
    padding: theme.spacing(1.5),
    width: '100%',

    [theme.breakpoints.up('md')]: {
        height: 'calc(100dvh - 180px)',
    },
}));
