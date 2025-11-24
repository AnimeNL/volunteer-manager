// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';
import { useFormContext } from '@components/proxy/react-hook-form-mui';

import { AutocompleteElement } from '@components/proxy/react-hook-form-mui';

import type { SxProps } from '@mui/system';
import type { Theme } from '@mui/material/styles';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { darken, lighten } from '@mui/system/colorManipulator';

import type { TimelineEvent } from '@beverloo/volunteer-manager-timeline';
import { ApplicationAvailabilityForm } from '@app/registration/[slug]/application/ApplicationParticipation';
import { AvailabilityTimelineImpl } from './AvailabilityTimelineImpl';
import { HiddenInput } from '@components/HiddenInput';
import { Temporal, isAfter, isBefore } from '@lib/Temporal';

import { kAvailabilityTimelineColours, kAvailabilityTimelineTitles }
    from './AvailabilityTimelineImpl';

/**
 * Custom styles applied to the <AvailabilityPreferences> & related components.
 */
const kStyles: { [key: string]: SxProps<Theme> } = {
    sectionHeader: theme => {
        const getBackgroundColor = theme.palette.mode === 'light' ? lighten : darken;
        return {
            backgroundColor: getBackgroundColor(theme.palette.action.active, 0.9),
            borderRadius: theme.shape.borderRadius,
        };
    },
};

/**
 * Props accepted by the <AvailabilityPreferences> component.
 */
interface AvailabilityPreferencesProps {
    /**
     * Information that needs to be known about the event in order to render the timeline.
     */
    event: {
        startTime: string;
        endTime: string;
        timezone: string;
    };

    /**
     * Maximum number of events that the volunteer can request exemption from.
     */
    exceptionEventLimit: number;

    /**
     * Events that can be selected as the ones that the volunteer plans to attend.
     */
    exceptionEvents: { id: number; label: string }[];

    /**
     * Serialised string containing the exceptions made to the volunteer's availability.
     */
    exceptions?: string;

    /**
     * Whether the option should be available where a volunteer can indicate that they're helping
     * out during the festival's build-up.
     */
    includeBuildUp?: boolean;

    /**
     * Whether the option should be available where a volunteer can indicate that they're helping
     * out during the festival's tear-down.
     */
    includeTearDown?: boolean;

    /**
     * Whether the form should be displayed in read-only mode.
     */
    readOnly?: boolean;

    /**
     * Time step, in minutes, defining the granularity of events in the exception view.
     */
    step?: number;
}

/**
 * The <AvailabilityPreferences> client-side component displays the volunteer's availability
 * preferences, together with the events they plan to attend and the availability exceptions that
 * have been applied to their participation.
 */
export function AvailabilityPreferences(props: AvailabilityPreferencesProps) {
    const { setValue, watch } = useFormContext();

    // ---------------------------------------------------------------------------------------------
    // Deal with timeline changes for any exceptions to the volunteer's availability.
    // ---------------------------------------------------------------------------------------------

    const firstValidException = Temporal.ZonedDateTime.from(props.event.startTime)
            .withTimeZone(props.event.timezone).with({ hour: 6, minute: 0, second: 0 });

    const lastValidException = Temporal.ZonedDateTime.from(props.event.endTime)
        .withTimeZone(props.event.timezone).with({ hour: 22, minute: 0, second: 0 });

    const [ timeslots, setTimeslots ] = useState<TimelineEvent[]>(() => {
        const initialTimeslots: TimelineEvent[] = [];
        if (props.exceptions && props.exceptions.length > 2) {
            try {
                const unverifiedTimeslots = JSON.parse(props.exceptions);
                for (const timeslot of unverifiedTimeslots) {
                    const start = Temporal.ZonedDateTime.from(timeslot.start);
                    const end = Temporal.ZonedDateTime.from(timeslot.end);

                    if (isAfter(firstValidException, end))
                        continue;  // exception happens before the event
                    if (isBefore(lastValidException, start))
                        continue;  // exception happens after the event

                    let state: keyof typeof kAvailabilityTimelineTitles = 'unavailable';
                    switch (timeslot.state) {
                        case 'available':
                        case 'avoid':
                        case 'unavailable':
                            state = timeslot.state;
                            break;
                    }

                    initialTimeslots.push({
                        id: `anime/${initialTimeslots.length}`,
                        start: start.toString({ timeZoneName: 'never' }),
                        end: end.toString({ timeZoneName: 'never' }),
                        title: kAvailabilityTimelineTitles[state],
                        color: kAvailabilityTimelineColours[state],

                        // Internal properties:
                        animeConState: state,
                    });
                }
            } catch (error: any) {
                console.error('Unable to parse availability exceptions:', error);
            }
        }

        return initialTimeslots;
    });

    const handleTimelineChange = useCallback((timeslots: TimelineEvent[]) => {
        setTimeslots(timeslots);
        setValue('exceptions', JSON.stringify(timeslots.map(timeslot => {
            if (!timeslot.start || !timeslot.end || !timeslot.animeConState)
                return null;  // invalid `timeslot`

            return {
                start: timeslot.start,
                end: timeslot.end,
                state: timeslot.animeConState,
            };

        })), { shouldDirty: true });

    }, [ setValue ]);

    // ---------------------------------------------------------------------------------------------
    // Compute the number of events that the volunteer plans to attend. This is a dynamic number
    // shown as the header of a collapsable section, so we want it to update in real time.
    // ---------------------------------------------------------------------------------------------

    const fieldNames =
        [ ...Array(props.exceptionEventLimit) ].map((_, index) => `exceptionEvents[${index}]`);

    const values = watch(fieldNames);

    let numberOfEventsToAttend = 0;
    for (const value of values) {
        if (!!value)
            numberOfEventsToAttend++;
    }

    // ---------------------------------------------------------------------------------------------

    return (
        <>
            <ApplicationAvailabilityForm eventStartDate={props.event.startTime}
                                         eventEndDate={props.event.endTime}
                                         includeBuildUp={props.includeBuildUp}
                                         includeDietaryRestrictions
                                         includeTearDown={props.includeTearDown}
                                         readOnly={props.readOnly} />

            <Grid size={{ xs: 12 }}>
                <Accordion disableGutters elevation={0} square>
                    <AccordionSummary expandIcon={ <ExpandMoreIcon /> } sx={kStyles.sectionHeader}>
                        <Typography>
                            Events they plan to attend
                        </Typography>
                        <Typography sx={{ color: 'text.disabled', pl: 1 }}>
                            ({numberOfEventsToAttend})
                        </Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 2, pb: 0 }}>
                        <Grid container spacing={2}>
                            { [ ...Array(props.exceptionEventLimit) ].map((_, index) =>
                                <Grid key={index} size={{ xs: 12 }}>
                                    <AutocompleteElement name={`exceptionEvents[${index}]`}
                                                         autocompleteProps={{
                                                             fullWidth: true,
                                                             readOnly: props.readOnly,
                                                             size: 'small',
                                                         }}
                                                         label="Event…"
                                                         options={props.exceptionEvents} matchId />
                                </Grid> )}
                        </Grid>
                    </AccordionDetails>
                </Accordion>
            </Grid>

            <HiddenInput name="exceptions" />

            <Grid size={{ xs: 12 }}>
                <Accordion disableGutters elevation={0} square>
                    <AccordionSummary expandIcon={ <ExpandMoreIcon /> } sx={kStyles.sectionHeader}>
                        <Typography>
                            Availability exceptions
                        </Typography>
                        <Typography sx={{ color: 'text.disabled', pl: 1 }}>
                            ({timeslots.length})
                        </Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 2, pb: 0 }}>
                        <AvailabilityTimelineImpl event={props.event} step={props.step}
                                                  timeslots={timeslots}
                                                  readOnly={props.readOnly}
                                                  onChange={handleTimelineChange} />
                    </AccordionDetails>
                </Accordion>
            </Grid>
        </>
    );
}
