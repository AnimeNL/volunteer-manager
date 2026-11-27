// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import React from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { AvailabilityDayInfo, AvailabilityExpectation } from './AvailabilityExpectationsClient';
import type { AvailabilitySegment, EventAvailabilityException, RequestedProgramTimeslot }
    from '@lib/event';
import type { TimeslotWithZonedDateTimes }
    from '@app/admin/events/[event]/[team]/volunteers/[volunteer]/preferences/getAvailabilityTimeslots';
import { AvailabilityExpectationDay, AvailabilityLegend } from './AvailabilityExpectationsClient';
import { computeAvailabilityTimeline, parseAvailabilityExceptions } from '@lib/event';
import { formatDate, isBefore } from '@lib/Temporal';
import { readSettings } from '@lib/Settings';

/**
 * Props accepted by the <AvailabilityExpectations> component.
 */
interface AvailabilityExpectationsProps {
    /**
     * Events that should be considered for the volunteer's preferences in regards to attendance.
     */
    availabilityEvents: TimeslotWithZonedDateTimes[];

    /**
     * Date and time at which the event is expected to start.
     */
    eventStartTime: Temporal.ZonedDateTime;

    /**
     * Date and time at which the event is expected to end.
     */
    eventEndTime: Temporal.ZonedDateTime;

    /**
     * Timezone in which the event will be taking place.
     */
    eventTimezone: string;

    /**
     * The events that the volunteer would like to attend, if any.
     */
    exceptionEvents?: number[];

    /**
     * Unverified availability exceptions that may be set for the volunteer.
     */
    exceptions?: string;

    /**
     * Preferred timing of the volunteer and their shifts. While these are guidelines, we do want to
     * visualise them on the expectation timeline.
     */
    timing?: {
        start?: number;
        end?: number;
    } | null;
}

/**
 * Returns whether any interval in `intervals` overlaps `[startMs, endMs)`.
 */
function hasOverlap(
    intervals: readonly { readonly startMs: number; readonly endMs: number }[],
    startMs: number,
    endMs: number): boolean
{
    return intervals.some(interval => interval.startMs < endMs && interval.endMs > startMs);
}

/**
 * Resolves the single hourly expectation rendered for `[hourStartMs, hourEndMs)` on the
 * availability expectations page. On the first day of the festival, hours 10:00–12:00 default to
 * `avoid` and hours 12:00–14:00 default to `available` regardless of timing preferences, while
 * remaining overridable by explicit availability exceptions (and requested events for 12:00–14:00).
 */
function resolveHourlyExpectation(
    timeline: readonly AvailabilitySegment[],
    exceptions: readonly EventAvailabilityException[],
    requestedTimeslots: readonly RequestedProgramTimeslot[],
    isFirstDay: boolean,
    hour: number,
    hourStartMs: number,
    hourEndMs: number): AvailabilityExpectation
{
    if (isFirstDay && !hasOverlap(exceptions, hourStartMs, hourEndMs)) {
        if (hour === 10 || hour === 11)
            return 'avoid';
        if (hour === 12 || hour === 13)
            return hasOverlap(requestedTimeslots, hourStartMs, hourEndMs) ? 'avoid' : 'available';
    }

    let hasAvailable = false;
    let hasAvoid = false;
    let hasUnavailable = false;

    for (const segment of timeline) {
        if (segment.endMs <= hourStartMs)
            continue;
        if (segment.startMs >= hourEndMs)
            break;

        if (segment.kind === 'unavailable')
            hasUnavailable = true;
        else if (segment.kind === 'avoid')
            hasAvoid = true;
        else
            hasAvailable = true;
    }

    if (hasUnavailable)
        return 'unavailable';
    if (hasAvoid)
        return 'avoid';

    return hasAvailable ? 'available' : 'unavailable';
}

/**
 * The <AvailabilityExpectations> component fetches and then renders an overview of when we expect
 * the volunteer to be available during the festival. It represents three separate states: avoid,
 * available and unavailable. It will be updated whenever the volunteer's preferences change.
 */
export async function AvailabilityExpectations(props: AvailabilityExpectationsProps) {
    const timezone = props.eventTimezone;

    const boundarySettings = await readSettings([
        'schedule-event-view-start-hours',
        'schedule-event-view-end-hours',
    ]);

    const exceptionEventIds = new Set(props.exceptionEvents);
    const requestedTimeslots: RequestedProgramTimeslot[] = [];

    for (const eventTimeslot of props.availabilityEvents) {
        if (!exceptionEventIds.has(eventTimeslot.id))
            continue;
        if (!eventTimeslot.startTime || !eventTimeslot.endTime)
            continue;

        requestedTimeslots.push({
            id: eventTimeslot.id,
            startMs: eventTimeslot.startTime.epochMilliseconds,
            endMs: eventTimeslot.endTime.epochMilliseconds,
        });
    }

    const exceptions = parseAvailabilityExceptions(props.exceptions);

    const timeline = computeAvailabilityTimeline(
        {
            event: {
                startTime: props.eventStartTime,
                endTime: props.eventEndTime,
                timeZone: timezone,
            },
            boundaryHours: {
                beforeStart: boundarySettings['schedule-event-view-start-hours'],
                afterEnd: boundarySettings['schedule-event-view-end-hours'],
            },
            availability: {
                preferenceTimingStart: props.timing?.start,
                preferenceTimingEnd: props.timing?.end,
                exceptions,
                requestedTimeslots,
            },
        },
        {
            includePreferenceBuffer: true,
            includeRequestedEvents: true,
            includeShifts: false,
        });

    const startDate = props.eventStartTime.withTimeZone(timezone).startOfDay();
    const endDate = props.eventEndTime.withTimeZone(timezone).with({
        hour: 23,
        minute: 59,
        second: 59,
    });

    const expectations: AvailabilityDayInfo[] = [];
    for (let date = startDate; isBefore(date, endDate); date = date.add({ days: 1 })) {
        const isFirstDay = expectations.length === 0;
        expectations.push({
            label: formatDate(date, 'dddd, MMMM D'),
            expectations: [ ...Array(/* hours= */ 24) ].map((_, hour) => {
                const hourStart = date.add({ hours: hour });
                const hourEnd = hourStart.add({ hours: 1 });
                return resolveHourlyExpectation(
                    timeline, exceptions, requestedTimeslots, isFirstDay, hour,
                    hourStart.epochMilliseconds, hourEnd.epochMilliseconds);
            }),
        });
    }

    return (
        <Box sx={{ my: 1 }}>
            <Typography variant="h5">
                Your availability at the festival
            </Typography>
            <Grid container spacing={2} sx={{ my: 2 }}>
                { expectations.map((info, index) =>
                    <React.Fragment key={index}>
                        <Grid size={{ xs: 12, lg: 2 }}>
                            {info.label}
                        </Grid>
                        <Grid size={{ xs: 12, lg: 10 }}>
                            <AvailabilityExpectationDay info={info} />
                        </Grid>
                    </React.Fragment> )}
            </Grid>
            <Stack spacing={4} direction="row" sx={{ mb: 2 }}>
                <AvailabilityLegend expectation="unavailable" />
                <AvailabilityLegend expectation="avoid" />
                <AvailabilityLegend expectation="available" />
            </Stack>
        </Box>
    );
}
