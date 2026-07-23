// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import React from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { EventTimeslotEntry } from './getPublicEventsForFestival';
import { formatDate, isAfter, isBefore } from '@lib/Temporal';

import type { AvailabilityDayInfo, AvailabilityExpectation } from './AvailabilityExpectationsClient';
import { AvailabilityExpectationDay, AvailabilityLegend } from './AvailabilityExpectationsClient';

/**
 * Returns whether `one` and `two` fall on the same day.
 */
function isSameDay(one: Temporal.ZonedDateTime, two: Temporal.ZonedDateTime) {
    return one.year === two.year &&
           one.month === two.month &&
           one.day === two.day;
}

/**
 * Props accepted by the <AvailabilityExpectations> component.
 */
interface AvailabilityExpectationsProps {
    /**
     * Events that should be considered for the volunteer's preferences in regards to attendance.
     */
    availabilityEvents: EventTimeslotEntry[];

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
 * The <AvailabilityExpectations> component fetches and then renders an overview of when we expect
 * the volunteer to be available during the festival. It represents three separate states: avoid,
 * available and unavailable. It will be updated whenever the volunteer's preferences change.
 */
export async function AvailabilityExpectations(props: AvailabilityExpectationsProps) {
    const timezone = props.eventTimezone;

    const serviceTimingStart: number | undefined = props.timing?.start;
    const serviceTimingEnd: number | undefined = props.timing?.end;

    const startDateEvent = props.eventStartTime.withTimeZone(timezone);
    const startDate = startDateEvent.with({
        hour: 0,
        minute: 0,
        second: 0,
    });

    const endDateEvent = props.eventEndTime.withTimeZone(timezone);
    const endDate = endDateEvent.with({
        hour: 23,
        minute: 59,
        second: 59,
    });

    // ---------------------------------------------------------------------------------------------
    // Determine the exceptions. These are stored in the database, but have to be parsed which can
    // for a variety of reasons fail, not least of all developer error.
    // ---------------------------------------------------------------------------------------------

    const exceptions = new Map</* YYYY-MM-DDTH */ string, AvailabilityExpectation>;
    if (props.exceptions && props.exceptions.length > 2) {
        try {
            const exceptionArray = JSON.parse(props.exceptions);
            for (const exception of exceptionArray) {
                if (!('start' in exception) || !('end' in exception) || !('state' in exception))
                    continue;

                const end = Temporal.ZonedDateTime.from(exception.end).withTimeZone(timezone);
                const start =
                    Temporal.ZonedDateTime.from(exception.start).withTimeZone(timezone).with({
                        minute: 0,
                    });

                for (let time = start; isBefore(time, end); time = time.add({ hours: 1 }))
                    exceptions.set(formatDate(time, 'YYYY-MM-DD[T]H'), exception.state);
            }

        } catch (error: any) {
            console.error('Unable to parse exception information:', error);
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Determine the timeslots that the volunteer has selected as wanting to attend.
    // ---------------------------------------------------------------------------------------------

    const selectedEvents: EventTimeslotEntry[] = [];
    if (!!props.exceptionEvents) {
        const exceptionEventIds = new Set(props.exceptionEvents);
        for (const availabilityEvent of props.availabilityEvents) {
            if (exceptionEventIds.has(availabilityEvent.id))
                selectedEvents.push(availabilityEvent);
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Actually determine the expectations. We do this by iterating over each of the days, then over
    // each of the hours within those days, to determine what's going on.
    // ---------------------------------------------------------------------------------------------

    const expectations: AvailabilityDayInfo[] = [];
    for (let date = startDate; isBefore(date, endDate); date = date.add({ days: 1 })) {
        const dateString = formatDate(date, 'YYYY-MM-DD');

        expectations.push({
            label: formatDate(date, 'dddd, MMMM D'),
            expectations: [ ...Array(/* hours= */ 24) ].map((_, hour) => {
                const hourlyDateTime = date.add({ hours: hour });
                let decidedStatus: AvailabilityExpectation = 'available';

                // Consider exceptions that have been approved by the volunteering leads. When one
                // is seen, all other processing will be moot.
                const exception = exceptions.get(`${dateString}T${hour}`);
                if (!!exception)
                    return exception;

                // Consider the window in which the volunteer indicated they want to help out with
                // shifts. We'll add some grace, but otherwise will roster them out at other times.
                if (serviceTimingStart !== undefined && serviceTimingEnd !== undefined) {
                    if (serviceTimingEnd > serviceTimingStart) {
                        // Case (1): The volunteer's shifts will start and end on the same day.
                        const hoursUntilWindowStart = serviceTimingStart - hour;
                        const hoursUntilWindowEnd = serviceTimingEnd - hour;

                        if (hoursUntilWindowStart > 1)
                            decidedStatus = 'unavailable';
                        else if (hoursUntilWindowStart > 0)
                            decidedStatus = 'avoid';

                        if (hoursUntilWindowEnd === 0)
                            decidedStatus = 'avoid';
                        else if (hoursUntilWindowEnd < 0)
                            decidedStatus = 'unavailable';

                    } else {
                        // Case (2): The volunteer's shifts will start and end on separate days.
                        const hoursUntilWindowStart = serviceTimingStart - hour;

                        if (!isSameDay(date, startDate)) {
                            if (hour === serviceTimingEnd)
                                decidedStatus = 'avoid';
                            else if (hour > serviceTimingEnd && hoursUntilWindowStart > 2)
                                decidedStatus = 'unavailable';
                        }

                        if (hour > serviceTimingEnd) {
                            if (hoursUntilWindowStart > 1)
                                decidedStatus = 'unavailable';
                            else if (hoursUntilWindowStart > 0)
                                decidedStatus = 'avoid';
                        }
                    }
                }

                // Consider the events that the volunteer has selected as wanting to attend. We only
                // reduce the availability here, in other words "available" becomes "avoid", but
                // "unavailable" remains "unavailable".
                if (decidedStatus !== 'unavailable' && selectedEvents.length > 0) {
                    const nextHourlyDateTime = hourlyDateTime.add({ hours: 1 });
                    for (const eventTimeslot of selectedEvents) {
                        if (!eventTimeslot.startTime || !eventTimeslot.endTime)
                            continue;  // incomplete timeslot

                        if (isBefore(eventTimeslot.startTime, nextHourlyDateTime) &&
                                isAfter(eventTimeslot.endTime, hourlyDateTime)) {
                            decidedStatus = 'avoid';
                        }
                    }
                }

                // We won't schedule shifts (well) before the festival's opening time without having
                // discussed this with the volunteer.
                if (isSameDay(date, startDate)) {
                    const hoursUntilOpening = hourlyDateTime.until(startDateEvent, {
                        largestUnit: 'hours'
                    }).hours;

                    if (hoursUntilOpening > 3)
                        return 'unavailable';
                    else if (hoursUntilOpening > 1)
                        return 'avoid';  // always invite volunteers to the briefing
                }

                // Similarly, we won't schedule shifts after the festival has finished. Folks are
                // welcome to stick around, but we won't count on it.
                if (isSameDay(date, endDate)) {
                    const hoursUntilClosure = hourlyDateTime.until(endDateEvent, {
                        largestUnit: 'hours'
                    }).hours;

                    if (hoursUntilClosure <= 0)
                        return 'unavailable';
                }

                // If all else fails, the volunteer will be available.
                return decidedStatus;
            }),
        });
    }

    // ---------------------------------------------------------------------------------------------

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
