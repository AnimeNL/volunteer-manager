// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useMemo } from 'react';

import { SelectElement, TextFieldElement, useFormContext } from '@proxy/react-hook-form-mui';

import Divider from '@mui/material/Divider';
import DomainAddIcon from '@mui/icons-material/DomainAdd';
import DomainDisabledIcon from '@mui/icons-material/DomainDisabled';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

import { HiddenInput } from '@components/HiddenInput';
import { formatDate } from '@lib/Temporal';

import { kAvailabilityBuildUpTearDownScheme, kServiceHoursOptions, kServiceTimingOption }
    from './AvailabilitySettings';

/**
 * Formats the date relative to `date` with the given `offsetDays` in days. The `date` must be a
 * string in a Temporal-specific serialisation.
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
     * Information required to contextualise towards the event.
     */
    event: {
        /**
         * Date and time at which the event will commence.
         */
        startTime: string;

        /**
         * Date and time at which the event will conclude.
         */
        endTime: string;
    };

    /**
     * Whether to request their availability for helping with festival build up.
     */
    includeBuildUp?: boolean;

    /**
     * Whether to request their availability for helping with festival tear down.
     */
    includeTearDown?: boolean;

    /**
     * Whether form fields should be rendered in read-only mode.
     */
    readOnly?: boolean;
}

/**
 * Form through which a volunteer's availability can be managed.
 */
export function AvailabilityForm(props: AvailabilityFormProps) {
    const { readOnly } = props;

    const { setValue, watch } = useFormContext();

    // ---------------------------------------------------------------------------------------------
    // Build-up and tear-down availability management.
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

        // Update the `field` with the new `value`:
        buildUpTearDown[field as keyof typeof buildUpTearDown] = value || 'No';

        setValue('buildUpTearDown', JSON.stringify(buildUpTearDown), {
            shouldDirty: true,
        });

    }, [ buildUpDayBefore, buildUpOpening, setValue, tearDownClosing, tearDownDayAfter ]);

    const changeHandlers = useMemo(() => ({
        buildUpDayBefore: handleBuildUpTearDownChange.bind(null, 'buildUpDayBefore'),
        buildUpOpening: handleBuildUpTearDownChange.bind(null, 'buildUpOpening'),
        tearDownClosing: handleBuildUpTearDownChange.bind(null, 'tearDownClosing'),
        tearDownDayAfter: handleBuildUpTearDownChange.bind(null, 'tearDownDayAfter'),

    }), [ handleBuildUpTearDownChange ])

    // ---------------------------------------------------------------------------------------------

    return (
        <>
            <Grid size={{ xs: 12, sm: 6 }}>
                <SelectElement name="hours" label="Amount of shifts" required fullWidth size="small"
                               options={kServiceHoursOptions}
                               slotProps={{ input: { readOnly } }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
                <SelectElement name="timing" label="Timing of shifts" required fullWidth
                               options={kServiceTimingOption} size="small"
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
                                               onChange={changeHandlers.tearDownDayAfter}>
                                <ToggleButton value="12:00">until 12:00</ToggleButton>
                                <ToggleButton value="18:00">18:00</ToggleButton>
                                <ToggleButton value="No">No</ToggleButton>
                            </ToggleButtonGroup>
                        </BuildUpTearDownDayContainer>
                    </Stack>
                </BuildUpTearDownGridItem> }
            { /* TODO: Events they plan to attend */ }
            { /* TODO: Availability exceptions */ }
        </>
    );
}

/**
 * Grid container for the build up and tear down availability obxes.
 */
const BuildUpTearDownGridItem = styled(Grid)(({ theme }) => ({
    border: `1px solid ${theme.vars?.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(1, 2),
}));

/**
 * Stack for the option space for build up and tear down soliciting.
 */
const BuildUpTearDownDayContainer = styled(Stack)(({ theme }) => ({
    alignItems: 'center',
    justifyContent: 'space-between',
}));
