// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { AutocompleteElement, SelectElement, TextFieldElement, useFormContext }
    from '@proxy/react-hook-form-mui';

import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Divider from '@mui/material/Divider';
import DomainAddIcon from '@mui/icons-material/DomainAdd';
import DomainDisabledIcon from '@mui/icons-material/DomainDisabled';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Grid from '@mui/material/Grid';
import LabelImportantOutlinedIcon from '@mui/icons-material/LabelImportantOutlined';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

import type { TimelineEvent } from '@app/admin/components/Timeline';
import { HiddenInput } from '@components/HiddenInput';
import { formatDate, isAfter, isBefore } from '@lib/Temporal';

import { kAvailabilityBuildUpTearDownScheme, kAvailabilityTimelineColours,
    kAvailabilityTimelineTitles, kServiceHoursOptions, kServiceTimingOptions }
        from './AvailabilitySettings';

/**
 * Dynamically loads the timeline component to reduce bundle size.
 */
const AvailabilityFormTimeline = dynamic(() => import('./AvailabilityFormTimeline'), {
    ssr: false,
});

/**
 * Formats a date relative to the given date by adding or subtracting days.
 */
function formatRelativeDate(date: string, offsetDays: number): string {
    const zonedDateTime = Temporal.ZonedDateTime.from(date);
    const adjustedZonedDateTime = zonedDateTime.add({ days: offsetDays });

    return formatDate(adjustedZonedDateTime, 'dddd, MMMM D');
}

/**
 * Props accepted by the <AvailabilityForm> component.
 */
interface AvailabilityFormProps {
    /**
     * Event configuration containing dates and timezone.
     */
    event: {
        /**
         * Start date and time of the event.
         */
        startTime: string;

        /**
         * End date and time of the event.
         */
        endTime: string;

        /**
         * Timezone in which the event takes place.
         */
        timeZone: string;
    };

    /**
     * Enables availability options for event build-up.
     */
    includeBuildUp?: boolean;

    /**
     * Enables availability options for event tear-down.
     */
    includeTearDown?: boolean;

    /**
     * Enables availability exception management.
     */
    includeExceptions?: {
        /**
         * Whether the exception section starts expanded.
         */
        open: boolean;

        /**
         * Time step in minutes for timeline items.
         */
        step: number;
    };

    /**
     * Displays form fields in read-only mode.
     */
    readOnly?: boolean;

    /**
     * Configuration for selectable timeslots.
     */
    timeslots: {
        /**
         * Maximum number of selectable timeslots.
         */
        limit: number;

        /**
         * Whether the timeslots section starts expanded.
         */
        open?: boolean;

        /**
         * List of available timeslots.
         */
        options: { id: number; label: string; }[];
    };
}

/**
 * Form to manage volunteer availability preferences.
 */
export function AvailabilityForm(props: AvailabilityFormProps) {
    const { readOnly } = props;

    const { getValues, setValue, watch, formState: { defaultValues } } = useFormContext();

    // ---------------------------------------------------------------------------------------------
    // Build-up and tear-down availability management
    // ---------------------------------------------------------------------------------------------

    let buildUpDayBefore: string = 'No';
    let buildUpOpening: string = 'No';
    let tearDownClosing: string = 'No';
    let tearDownDayAfter: string = 'No';

    const serialisedBuildUpTearDown = watch('buildUpTearDown');
    const validatedBuildUpTearDown = useMemo(() => {
        try {
            if (!serialisedBuildUpTearDown || serialisedBuildUpTearDown === 'undefined')
                return { success: false, data: null! };

            const deserialisedBuildUpTearDown = JSON.parse(serialisedBuildUpTearDown);
            return kAvailabilityBuildUpTearDownScheme.safeParse(deserialisedBuildUpTearDown);
        } catch (error: any) {
            console.warn(`Unable to parse the build-up and tear-down data: ${error}`);
            return { success: false, data: null! };
        }
    }, [ serialisedBuildUpTearDown ]);

    if (validatedBuildUpTearDown.success) {
        buildUpDayBefore = validatedBuildUpTearDown.data.buildUpDayBefore;
        buildUpOpening = validatedBuildUpTearDown.data.buildUpOpening;
        tearDownClosing = validatedBuildUpTearDown.data.tearDownClosing;
        tearDownDayAfter = validatedBuildUpTearDown.data.tearDownDayAfter;
    }

    const handleBuildUpTearDownChange = useCallback((field: string, event: unknown, value: any) => {
        const buildUpTearDown =
            { buildUpDayBefore, buildUpOpening, tearDownClosing, tearDownDayAfter };

        buildUpTearDown[field as keyof typeof buildUpTearDown] = value || 'No';

        setValue('buildUpTearDown', JSON.stringify(buildUpTearDown), {
            shouldDirty: true,
        });

    }, [ buildUpDayBefore, buildUpOpening, setValue, tearDownClosing, tearDownDayAfter ]);

    // ---------------------------------------------------------------------------------------------

    const timeslotsDefaultValue = defaultValues?.timeslotsStr;
    const timeslotsFieldNames = useMemo(() => {
        return [ ...Array(props.timeslots.limit) ].map((_, index) => `timeslots.${index}`);
    }, [ props.timeslots.limit ]);

    useEffect(() => {
        const timeslotsStr = getValues('timeslotsStr') || timeslotsDefaultValue;
        if (!timeslotsStr)
            return;

        const timeslotIds = timeslotsStr
            .split(',')
            .map((value: string) => parseInt(value, /* radix= */ 10))
            .filter((value: number) => !Number.isNaN(value));

        for (let index = timeslotIds.length; index < props.timeslots.limit; index++)
            timeslotIds.push(undefined);

        setValue('timeslots', timeslotIds, {
            shouldDirty: true,
            shouldTouch: true,
        });

    }, [ getValues, props.timeslots.limit, setValue, timeslotsDefaultValue ]);

    const timeslotsValues = watch(timeslotsFieldNames);
    const timeslotsSelected = timeslotsValues.filter(Boolean).length;

    // ---------------------------------------------------------------------------------------------

    const firstValidException = Temporal.ZonedDateTime.from(props.event.startTime)
        .withTimeZone(props.event.timeZone).with({ hour: 6, minute: 0, second: 0 });

    const lastValidException = Temporal.ZonedDateTime.from(props.event.endTime)
        .withTimeZone(props.event.timeZone).with({ hour: 22, minute: 0, second: 0 });

    const [ timeslots, setTimeslots ] = useState<TimelineEvent[]>(() => {
        const initialTimeslots: TimelineEvent[] = [];
        if (defaultValues?.exceptions && defaultValues.exceptions.length > 2) {
            try {
                const unverifiedTimeslots = JSON.parse(defaultValues.exceptions);
                for (const timeslot of unverifiedTimeslots) {
                    const start = Temporal.ZonedDateTime.from(timeslot.start);
                    const end = Temporal.ZonedDateTime.from(timeslot.end);

                    if (isAfter(firstValidException, end))
                        continue;
                    if (isBefore(lastValidException, start))
                        continue;

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
                return null;

            return {
                start: timeslot.start,
                end: timeslot.end,
                state: timeslot.animeConState,
            };

        })), { shouldDirty: true });

    }, [ setValue ]);

    // ---------------------------------------------------------------------------------------------

    const changeHandlers = useMemo(() => ({
        buildUpDayBefore: handleBuildUpTearDownChange.bind(null, 'buildUpDayBefore'),
        buildUpOpening: handleBuildUpTearDownChange.bind(null, 'buildUpOpening'),
        tearDownClosing: handleBuildUpTearDownChange.bind(null, 'tearDownClosing'),
        tearDownDayAfter: handleBuildUpTearDownChange.bind(null, 'tearDownDayAfter'),

    }), [ handleBuildUpTearDownChange ]);

    return (
        <>
            <Grid size={{ xs: 12, sm: 6 }}>
                <SelectElement name="hours" label="Amount of shifts" required fullWidth size="small"
                               options={kServiceHoursOptions}
                               slotProps={{ input: { readOnly } }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
                <SelectElement name="timing" label="Timing of shifts" required fullWidth
                               options={kServiceTimingOptions} size="small"
                               slotProps={{ input: { readOnly } }} />
            </Grid>
            <Grid size={{ xs: 12 }}>
                <TextFieldElement name="remarks" fullWidth size="small" multiline
                                  label="Anything we should know about?"
                                  slotProps={{ input: { readOnly } }} />
            </Grid>
            { (!!props.includeBuildUp || !!props.includeTearDown) &&
                <HiddenInput name="buildUpTearDown" /> }
            { !!props.includeBuildUp &&
                <BuildUpTearDownGridItem size={{ xs: 12, lg: 6 }}>
                    <Stack direction="column" spacing={1}>
                        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                            <DomainAddIcon fontSize="small" />
                            <Typography>
                                Will you help with build-up?
                            </Typography>
                        </Stack>
                        <Divider />
                        <BuildUpTearDownDayContainer direction="row">
                            <Typography variant="body2">
                                { formatRelativeDate(props.event.startTime, /* offsetDays= */ -1) }
                            </Typography>
                            <ToggleButtonGroup exclusive size="small" value={buildUpDayBefore}
                                               disabled={props.readOnly}
                                               onChange={changeHandlers.buildUpDayBefore}>
                                <ToggleButton value="10:00+">10:00+</ToggleButton>
                                <ToggleButton value="14:00+">14:00+</ToggleButton>
                                <ToggleButton value="No">No</ToggleButton>
                            </ToggleButtonGroup>
                        </BuildUpTearDownDayContainer>
                        <BuildUpTearDownDayContainer direction="row">
                            <Typography variant="body2">
                                { formatRelativeDate(props.event.startTime, /* offsetDays= */ 0) }
                            </Typography>
                            <ToggleButtonGroup exclusive size="small" value={buildUpOpening}
                                               disabled={props.readOnly}
                                               onChange={changeHandlers.buildUpOpening}>
                                <ToggleButton value="10:00+">10:00+</ToggleButton>
                                <ToggleButton value="12:00+">12:00+</ToggleButton>
                                <ToggleButton value="No">No</ToggleButton>
                            </ToggleButtonGroup>
                        </BuildUpTearDownDayContainer>
                    </Stack>
                </BuildUpTearDownGridItem> }
            { !!props.includeTearDown &&
                <BuildUpTearDownGridItem size={{ xs: 12, lg: 6 }}>
                    <Stack direction="column" spacing={1}>
                        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                            <DomainDisabledIcon fontSize="small" />
                            <Typography>
                                Will you help with tear-down?
                            </Typography>
                        </Stack>
                        <Divider />
                        <BuildUpTearDownDayContainer direction="row">
                            <Typography variant="body2">
                                { formatRelativeDate(props.event.endTime, /* offsetDays= */ 0) }
                            </Typography>
                            <ToggleButtonGroup exclusive size="small" value={tearDownClosing}
                                               disabled={props.readOnly}
                                               onChange={changeHandlers.tearDownClosing}>
                                <ToggleButton value="19:00">until 19:00</ToggleButton>
                                <ToggleButton value="22:00">22:00</ToggleButton>
                                <ToggleButton value="No">No</ToggleButton>
                            </ToggleButtonGroup>
                        </BuildUpTearDownDayContainer>
                        <BuildUpTearDownDayContainer direction="row">
                            <Typography variant="body2">
                                { formatRelativeDate(props.event.endTime, /* offsetDays= */ 1) }
                            </Typography>
                            <ToggleButtonGroup exclusive size="small" value={tearDownDayAfter}
                                               disabled={props.readOnly}
                                               onChange={changeHandlers.tearDownDayAfter}>
                                <ToggleButton value="12:00">until 12:00</ToggleButton>
                                <ToggleButton value="18:00">18:00</ToggleButton>
                                <ToggleButton value="No">No</ToggleButton>
                            </ToggleButtonGroup>
                        </BuildUpTearDownDayContainer>
                    </Stack>
                </BuildUpTearDownGridItem> }
            { (!!props.timeslots.limit && !!props.timeslots.options.length) &&
                <Grid size={{ xs: 12 }}>
                    <HighlightAccordion defaultExpanded={props.timeslots.open}
                                        disableGutters elevation={0}>
                        <HighlightAccordionSummary expandIcon={ <ExpandMoreIcon /> }>
                            Events you would like to attend
                            { timeslotsSelected > 0 &&
                                <Typography component="span" color="textDisabled" variant="inherit">
                                    &nbsp;({timeslotsSelected})
                                </Typography> }
                        </HighlightAccordionSummary>
                        <AccordionDetails sx={{ pt: 2, pb: 0 }}>
                            <Stack direction="column" spacing={2}>
                                { [ ...Array(props.timeslots.limit) ].map((_, index) =>
                                    <Stack key={index} direction="row" spacing={2} sx={{
                                        alignItems: 'center',
                                    }}>
                                        <LabelImportantOutlinedIcon
                                            color="primary" fontSize="small" />
                                        <AutocompleteElement
                                            name={`timeslots.${index}`}
                                            label="Event…" matchId options={props.timeslots.options}
                                            autocompleteProps={{
                                                fullWidth: true,
                                                readOnly: props.readOnly,
                                                size: 'small',
                                            }} />
                                    </Stack> ) }
                            </Stack>
                        </AccordionDetails>
                    </HighlightAccordion>
                </Grid> }
            { !!props.includeExceptions &&
                <Grid size={{ xs: 12 }}>
                    <HighlightAccordion defaultExpanded={props.includeExceptions?.open}
                                        disableGutters elevation={0}>
                        <HighlightAccordionSummary expandIcon={ <ExpandMoreIcon /> }>
                            Availability exceptions
                            { timeslots.length > 0 &&
                                <Typography component="span" color="textDisabled" variant="inherit">
                                    &nbsp;({timeslots.length})
                                </Typography> }
                        </HighlightAccordionSummary>
                        <AccordionDetails sx={{ pt: 2, pb: 0 }}>
                            <HiddenInput name="exceptions" />
                            <AvailabilityFormTimeline
                                event={props.event} timeslots={timeslots}
                                onChange={handleTimelineChange}
                                readOnly={props.readOnly}
                                step={props.includeExceptions.step} />
                        </AccordionDetails>
                    </HighlightAccordion>
                </Grid> }
        </>
    );
}

/**
 * Grid container for build-up and tear-down availability options.
 */
const BuildUpTearDownGridItem = styled(Grid)(({ theme }) => ({
    border: `1px solid ${theme.vars?.palette.divider || theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(1, 2),
}));

/**
 * Stack container for each build-up or tear-down day option.
 */
const BuildUpTearDownDayContainer = styled(Stack)(() => ({
    alignItems: 'center',
    justifyContent: 'space-between',
}));

/**
 * Accordion container with highlighted background.
 */
const HighlightAccordion = styled(Accordion)(() => ({
    backgroundColor: 'unset',
}));

/**
 * Summary element for highlighted accordions.
 */
const HighlightAccordionSummary = styled(AccordionSummary)(({ theme }) => ({
    backgroundColor:
        theme.vars?.palette.backgroundHighlight as string
        || theme.palette.backgroundHighlight as string,
    borderRadius: theme.shape.borderRadius,
    fontSize: theme.typography.body1.fontSize,
}));
