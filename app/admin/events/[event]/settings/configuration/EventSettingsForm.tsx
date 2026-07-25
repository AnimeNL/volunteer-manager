// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { DateTimePickerElement } from 'react-hook-form-mui/date-pickers';
import { TextFieldElement } from '@proxy/react-hook-form-mui';

import Grid from '@mui/material/Grid';

/**
 * Props accepted by the <EventSettingsForm> component.
 */
interface EventSettingsFormProps {
    /**
     * Whether the event slug should be mutable.
     */
    mutableSlug?: boolean;
}

/**
 * The <EventSettingsForm> component encapsulates the required settings for an event.
 */
export function EventSettingsForm(props: EventSettingsFormProps) {
    const { mutableSlug } = props;
    return (
        <>
            <Grid size={{ xs: 12 }}>
                <TextFieldElement name="name" label="Full event name" required fullWidth
                                  size="small" />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
                <TextFieldElement name="shortName" label="Short event name" required
                                  fullWidth size="small" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
                <TextFieldElement name="slug" label="Event slug" required fullWidth
                                  size="small" slotProps={{ input: { readOnly: !mutableSlug } }} />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
                <DateTimePickerElement name="startTime" label="Start time" required
                                       inputProps={{ fullWidth: true, size: 'small' }}
                                       textReadOnly />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
                <DateTimePickerElement name="endTime" label="End time" required
                                       inputProps={{ fullWidth: true, size: 'small' }}
                                       textReadOnly />
            </Grid>
        </>
    );
}
