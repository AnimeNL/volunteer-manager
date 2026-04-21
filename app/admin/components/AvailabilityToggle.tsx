// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AvailabilityToggleIndicator } from './AvailabilityToggleIndicator';
import { SelectElement } from '@proxy/react-hook-form-mui';

/**
 * Options available to the `<AvailabilityToggle>` component.
 */
const kAvailabilityToggleOptions = [
    { id: 0, label: 'Publish to Senior and Staff volunteers' },
    { id: 1, label: 'Publish to everyone' },
];

/**
 * Props accepted by the <AvailabilityToggle> component.
 */
interface AvailabilityToggleProps {
    /**
     * Label to display in front of this availability toggle.
     */
    label: string;

    /**
     * Name of the input field that will be added to the form.
     */
    name: string;
}

/**
 * The <AvailabilityToggle> component displays an input field that can be used to either turn on or
 * off publication of a particular field. A clear indicator will be shown at the end of the field.
 */
export function AvailabilityToggle(props: AvailabilityToggleProps) {
    return (
        <Grid size={{ xs: 12 }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <Typography variant="body2" sx={{ flexShrink: 0, width: '150px' }}>
                    {props.label}:
                </Typography>
                <SelectElement name={props.name} options={kAvailabilityToggleOptions}
                               fullWidth size="small" />
                <AvailabilityToggleIndicator field={props.name} />
            </Stack>
        </Grid>
    );
}
