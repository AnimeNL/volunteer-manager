// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { AutocompleteElement, TextFieldElement, SelectElement, useFormContext }
    from '@proxy/react-hook-form-mui';

import Alert from '@mui/material/Alert';
import Collapse from '@mui/material/Collapse';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';

/**
 * Options for the initiative select.
 */
const kShiftTypeOptions = [
    { id: 'program', label: 'Shift for a program entry' },
    { id: 'initiative', label: 'Shift for our own initiative' },
];

/**
 * Props accepted by the <ShiftSettingsForm> component.
 */
export interface ShiftSettingsFormProps {
    /**
     * The activities that can be selected when creating this shift.
     */
    activities: { id: number; label: string }[];

    /**
     * The categories of shifts that can be selected when creating a new one.
     */
    categories: { id: number; label: string }[];

    /**
     * The locations within which shifts of our own initiative can be located.
     */
    locations: { id: number; label: string }[];

    /**
     * Whether the `name` field should be included for either type of shift.
     */
    includeName?: boolean;

    /**
     * Whether the form should be in read-only mode.
     */
    readOnly?: boolean;
}

/**
 * The <ShiftSettingsForm> component manages the settings regarding a particular shift. It's used
 * both for creating new shifts, and managing existing shifts. The form may be displayed in read-
 * only mode in case a volunteer does not have permission to change the settings.
 */
export function ShiftSettingsForm(props: React.PropsWithChildren<ShiftSettingsFormProps>) {
    const { watch } = useFormContext();

    const type = watch('type');
    return (
        <>
            <Grid size={{ xs: 12, md: 6 }}>
                <SelectElement name="categoryId" label="Category" options={props.categories}
                               size="small" fullWidth required disabled={props.readOnly} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
                <SelectElement name="type" label="Type of shift" options={kShiftTypeOptions}
                               size="small" fullWidth required disabled={props.readOnly} />
            </Grid>
            <Grid size={{ xs: 12 }}>
                <Collapse in={ type !== 'initiative' && type !== 'program' }>
                    <Alert severity="info" variant="outlined">
                        Begin by selecting the type of shift you would like to add…
                    </Alert>
                </Collapse>
                <Collapse in={type === 'initiative'}>
                    <Stack direction="column" spacing={2}>
                        <TextFieldElement name="name" label="Shift name" fullWidth size="small"
                                          disabled={props.readOnly} />
                        <SelectElement name="locationId" label="Location" options={props.locations}
                                       size="small" fullWidth disabled={props.readOnly} />
                    </Stack>
                </Collapse>
                <Collapse in={type === 'program'}>
                    <Stack direction="column" spacing={2}>
                        <AutocompleteElement name="activityId" label="Associated activity"
                                             options={props.activities} matchId
                                             autocompleteProps={{
                                                 disabled: props.readOnly,
                                                 fullWidth: true,
                                                 size: 'small',
                                             }} />
                        { !!props.includeName &&
                            <TextFieldElement name="name" label="Shift name" fullWidth size="small"
                                            disabled={props.readOnly} /> }
                    </Stack>
                </Collapse>
            </Grid>
        </>
    );
}
