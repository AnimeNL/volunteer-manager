// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { SelectElement, TextFieldElement } from '@proxy/react-hook-form-mui';

import Grid from '@mui/material/Grid';

import { kServiceHoursOptions, kServiceTimingOption } from './AvailabilitySettings';

/**
 * Props accepted by the <AvailabilityForm> component.
 */
interface AvailabilityFormProps {
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
            { /* TODO: Build-up + tear-down */ }
            { /* TODO: Events they plan to attend */ }
            { /* TODO: Availability exceptions */ }
        </>
    );
}
