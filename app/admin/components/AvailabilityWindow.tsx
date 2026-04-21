// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AvailabilityWindowIndicator } from './AvailabilityWindowIndicator';
import { DateTimePickerElement } from '@proxy/react-hook-form-mui';

/**
 * Props accepted by the <AvailabilityWindow> component.
 */
interface AvailabilityWindowProps {
    /**
     * Name of the field that represents the ending time of this window.
     */
    end: string;

    /**
     * Label to display in front of this availability window.
     */
    label: string;

    /**
     * Name of the field that represents the starting time of this window.
     */
    start: string;

    /**
     * Timezone in which the input data will be represented.
     */
    timezone: string | undefined;
}

/**
 * The <AvailabilityWindow> component displays two full-width date time picker components, followed
 * by an icon indicating how that would play out given the current date and time.
 */
export function AvailabilityWindow(props: AvailabilityWindowProps) {
    return (
        <Grid size={{ xs: 12 }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <Typography variant="body2" sx={{ flexShrink: 0, width: '150px' }}>
                    {props.label}:
                </Typography>
                <DateTimePickerElement name={props.start} timezone={props.timezone}
                                       inputProps={{ fullWidth: true, size: 'small' }}
                                       slotProps={{ field: { clearable: true } }} />
                <Typography variant="body2">
                    until
                </Typography>
                <DateTimePickerElement name={props.end} timezone={props.timezone}
                                       inputProps={{ fullWidth: true, size: 'small' }}
                                       slotProps={{ field: { clearable: true } }} />
                <AvailabilityWindowIndicator fields={props} />
            </Stack>
        </Grid>
    );
}
