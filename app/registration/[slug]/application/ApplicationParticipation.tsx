// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import type { z } from 'zod/v4';
import { useCallback } from 'react';

import { SelectElement, TextareaAutosizeElement, useFormContext } from '@proxy/react-hook-form-mui';

import Divider from '@mui/material/Divider';
import DomainAddIcon from '@mui/icons-material/DomainAdd';
import DomainDisabledIcon from '@mui/icons-material/DomainDisabled';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import Typography from '@mui/material/Typography';

import { Temporal, formatDate } from '@lib/Temporal';

import type { kServiceHoursProperty, kServiceTimingProperty } from './ApplicationActions';
import { kAvailabilityBuildUpTearDownScheme } from './AvailabilityBuildUpTearDownScheme';
import { kShirtFit, kShirtSize, type ShirtFit, type ShirtSize } from '@lib/database/Types';

type ServiceHourValues = z.TypeOf<typeof kServiceHoursProperty>;
type ServiceTimingValues = z.TypeOf<typeof kServiceTimingProperty>;

/**
 * Valid options for the number of hours volunteers are willing to work. When updating an ID, make
 * sure that `kDefaultValues` is updated as well.
 */
const kServiceHoursOptions: { id: ServiceHourValues, label: string }[] = [
    { id: '12', label: 'Up to 12 hours' },
    { id: '16', label: '12–16 hours' },
    { id: '20', label: '16–20 hours' },
    { id: '24', label: 'More than 20 hours' },
];

/**
 * Valid options for the timing of shifts a volunteer could be issued. When updating an ID, make
 * sure that `kDefaultValues` is updated as well.
 */
const kServiceTimingOption: { id: ServiceTimingValues, label: string }[] = [
    { id: '8-20', label: 'Early (08:00–20:00)' },
    { id: '10-0', label: 'Regular (10:00–00:00)' },
    { id: '14-3', label: 'Late (14:00–03:00)' },
];

/**
 * Valid options for the t-shirt fit select field.
 */
const kTShirtFitOptions: { id: ShirtFit, label: string }[] =
    Object.values(kShirtFit).map(fit => ({ id: fit, label: fit }));

/**
 * Valid options for the t-shirt size select field.
 */
const kTShirtSizeOptions: { id: ShirtSize, label: string }[] = [
    { id: kShirtSize.XS, label: 'XS' },
    { id: kShirtSize.S, label: 'Small' },
    { id: kShirtSize.M, label: 'Medium' },
    { id: kShirtSize.L, label: 'Large' },
    { id: kShirtSize.XL, label: 'XL' },
    { id: kShirtSize.XXL, label: 'XXL' },
    { id: kShirtSize['3XL'], label: '3XL' },
    { id: kShirtSize['4XL'], label: '4XL' },
];

/**
 * Formats the date relative to `date` with the given `offsetDays` in days. The `date` must be a
 * string in a Temporal-specific serialisation.
 */
function formatRelativeDate(date: string, offsetDays: number): string {
    const zonedDateTime = Temporal.ZonedDateTime.from(date);
    const adjustedZonedDateTime = zonedDateTime.add({ days: offsetDays });

    return formatDate(adjustedZonedDateTime, 'dddd, MMMM Do');
}

/**
 * Props accepted by the <ApplicationAvailabilityForm> component.
 */
interface ApplicationAvailabilityFormProps {
    /**
     * Date at which the event will start, in a Temporal-compatible serialisation. Must be given
     * when `includeBuildUp` has been set to `true`.
     */
    eventStartDate?: string;

    /**
     * Date at which the event will end, in a Temporal-compatible serialisation. Must be given when
     * `includeTearDown` has been set to `true`.
     */
    eventEndDate?: string;

    /**
     * Whether the option should be available where a volunteer can indicate that they're helping
     * out during the festival's build-up.
     */
    includeBuildUp?: boolean;

    /**
     * Whether the dietary restrictions field should be included. Omitted from the registration form
     * as we want to minimsie the number of fields there.
     */
    includeDietaryRestrictions?: boolean;

    /**
     * Whether the option should be available where a volunteer can indicate that they're helping
     * out during the festival's tear-down.
     */
    includeTearDown?: boolean;

    /**
     * Whether the form should be locked, i.e. for all fields to be disabled.
     */
    readOnly?: boolean;
}

/**
 * The <ApplicationAvailabilityForm> component contains the necessary Grid rows to display a
 * volunteer's preferences in regards to the number of shifts they'll serve, the timing of those
 * shifts and further availability preferences they may have.
 */
export function ApplicationAvailabilityForm(props: ApplicationAvailabilityFormProps) {
    const { readOnly } = props;

    const { register, setValue, watch } = useFormContext();

    // Validate the variants:
    if (!!props.includeBuildUp && !props.eventStartDate)
        throw new Error('Invalid variant: must provide `eventStartDate` with `includeBuildUp`');
    if (!!props.includeTearDown && !props.eventEndDate)
        throw new Error('Invalid variant: must provide `eventEndDate` with `includeTearDown`');

    let buildUpDayBefore: string = 'No';
    let buildUpOpening: string = 'No';
    let tearDownClosing: string = 'No';
    let tearDownDayAfter: string = 'No';

    const availabilityBuildUpTearDown = watch('availabilityBuildUpTearDown');
    try {
        const parsedAvailabilityBuildUpTearDown =
            kAvailabilityBuildUpTearDownScheme.safeParse(JSON.parse(availabilityBuildUpTearDown));

        if (parsedAvailabilityBuildUpTearDown.success) {
            buildUpDayBefore = parsedAvailabilityBuildUpTearDown.data.buildUpDayBefore;
            buildUpOpening = parsedAvailabilityBuildUpTearDown.data.buildUpOpening;
            tearDownClosing = parsedAvailabilityBuildUpTearDown.data.tearDownClosing;
            tearDownDayAfter = parsedAvailabilityBuildUpTearDown.data.tearDownDayAfter;
        }
    } catch (error: any) {
        console.warn('Invalid availabilityBuildUpTearDown value', error);
    }

    const handleBuildUpTearDownChange = useCallback((field: string, event: unknown, value: any) => {
        const availabilityBuildUpTearDown = {
            buildUpDayBefore,
            buildUpOpening,
            tearDownClosing,
            tearDownDayAfter,
        };

        // Update the `field` with the new `value`:
        availabilityBuildUpTearDown[field as keyof typeof availabilityBuildUpTearDown]
            = value || 'No';

        setValue('availabilityBuildUpTearDown', JSON.stringify(availabilityBuildUpTearDown), {
            shouldDirty: true,
        });

    }, [ buildUpDayBefore, buildUpOpening, setValue, tearDownClosing, tearDownDayAfter ]);

    return (
        <>
            <Grid size={{ xs: 12, sm: 6 }}>
                <SelectElement name="serviceHours" label="Number of shifts" required
                               options={kServiceHoursOptions} fullWidth size="small"
                               disabled={readOnly} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
                <SelectElement name="serviceTiming" label="Timing of shifts" required
                               options={kServiceTimingOption} fullWidth size="small"
                               disabled={readOnly}  />
            </Grid>
            { !!props.includeDietaryRestrictions &&
                <Grid size={{ xs: 12 }}>
                    <TextareaAutosizeElement name="preferencesDietary" fullWidth size="small"
                                             label="Any dietary restrictions?"
                                             disabled={readOnly} />
                </Grid> }
            <Grid size={{ xs: 12 }}>
                <TextareaAutosizeElement name="preferences" fullWidth size="small"
                                         label="Anything we should know about?"
                                         disabled={readOnly} />
            </Grid>
            { (!!props.includeBuildUp || !!props.includeTearDown) &&
                <input type="hidden" {...register('availabilityBuildUpTearDown')} /> }
            { !!props.includeBuildUp &&
                <Grid size={{ xs: 12, md: 6 }} sx={{
                    border: '1px solid transparent',
                    borderColor: 'divider',
                    borderRadius: 1,
                    paddingX: 2,
                    paddingY: 1,
                }}>
                    <Stack direction="column" spacing={1}>
                        <Stack direction="row" spacing={2} alignItems="center">
                            <DomainAddIcon fontSize="small" />
                            <Typography>
                                Will you help with build-up?
                            </Typography>
                        </Stack>
                        <Divider />
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Typography variant="body2">
                                { formatRelativeDate(props.eventStartDate!, /* offsetDays= */ -1) }
                            </Typography>
                            <ToggleButtonGroup
                                exclusive size="small" value={buildUpDayBefore}
                                onChange={
                                    handleBuildUpTearDownChange.bind(null, 'buildUpDayBefore') }>
                                <ToggleButton value="10:00+">10:00+</ToggleButton>
                                <ToggleButton value="14:00+">14:00+</ToggleButton>
                                <ToggleButton value="No">No</ToggleButton>
                            </ToggleButtonGroup>
                        </Stack>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Typography variant="body2">
                                { formatRelativeDate(props.eventStartDate!, /* offsetDays= */ 0) }
                            </Typography>
                            <ToggleButtonGroup
                                exclusive size="small" value={buildUpOpening}
                                onChange={
                                    handleBuildUpTearDownChange.bind(null, 'buildUpOpening') }>
                                <ToggleButton value="10:00+">10:00+</ToggleButton>
                                <ToggleButton value="12:00+">12:00+</ToggleButton>
                                <ToggleButton value="No">No</ToggleButton>
                            </ToggleButtonGroup>
                        </Stack>
                    </Stack>
                </Grid> }
            { !!props.includeTearDown &&
                <Grid size={{ xs: 12, md: 6 }} sx={{
                    border: '1px solid transparent',
                    borderColor: 'divider',
                    borderRadius: 1,
                    paddingX: 2,
                    paddingY: 1,
                }}>
                    <Stack direction="column" spacing={1}>
                        <Stack direction="row" spacing={2} alignItems="center">
                            <DomainDisabledIcon fontSize="small" />
                            <Typography>
                                Will you help with tear-down?
                            </Typography>
                        </Stack>
                        <Divider />
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Typography variant="body2">
                                { formatRelativeDate(props.eventEndDate!, /* offsetDays= */ 0) }
                            </Typography>
                            <ToggleButtonGroup
                                exclusive size="small" value={tearDownClosing}
                                onChange={
                                    handleBuildUpTearDownChange.bind(null, 'tearDownClosing') }>
                                <ToggleButton value="19:00">until 19:00</ToggleButton>
                                <ToggleButton value="22:00">22:00</ToggleButton>
                                <ToggleButton value="No">No</ToggleButton>
                            </ToggleButtonGroup>
                        </Stack>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Typography variant="body2">
                                { formatRelativeDate(props.eventEndDate!, /* offsetDays= */ 1) }
                            </Typography>
                            <ToggleButtonGroup
                                exclusive size="small" value={tearDownDayAfter}
                                onChange={
                                    handleBuildUpTearDownChange.bind(null, 'tearDownDayAfter') }>
                                <ToggleButton value="12:00">until 12:00</ToggleButton>
                                <ToggleButton value="18:00">18:00</ToggleButton>
                                <ToggleButton value="No">No</ToggleButton>
                            </ToggleButtonGroup>
                        </Stack>
                    </Stack>
                </Grid> }
        </>
    );
}

/**
 * Props accepted by the <ApplicationParticipationForm> component.
 */
interface ApplicationParticipationFormProps {
    /**
     * Whether the form should be in read-only mode.
     */
    readOnly?: boolean;
}

/**
 * The <ApplicationParticipationForm> component contains the necessary information that has to be
 * filled in by a volunteer prior to their application to be submittable. This code is shared
 * between the registration front-end and the application management section for admins.
 */
export function ApplicationParticipationForm(props: ApplicationParticipationFormProps) {
    const { readOnly } = props;

    return (
        <>
            <Grid size={{ xs: 6 }}>
                <SelectElement name="tshirtSize" label="T-shirt size" required
                               options={kTShirtSizeOptions} fullWidth size="small"
                               slotProps={{ input: { readOnly } }} />
            </Grid>
            <Grid size={{ xs: 6 }}>
                <SelectElement name="tshirtFit" label="T-shirt fit" required
                               options={kTShirtFitOptions} fullWidth size="small"
                               slotProps={{ input: { readOnly } }} />
            </Grid>
        </>
    );
}
