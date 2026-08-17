// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { SelectElement } from '@proxy/react-hook-form-mui';

import Grid from '@mui/material/Grid';

import * as options from '@components/SelectElementOptions';

/**
 * Form through which a volunteer's participation preferences can be managed.
 */
export function ParticipationForm(props: { readOnly?: boolean }) {
    const { readOnly } = props;
    return (
        <>
            <Grid size={{ xs: 6 }}>
                <SelectElement name="tshirtSize" label="T-shirt size" required size="small"
                               options={options.kTShirtSizeOptions} fullWidth
                               slotProps={{ input: { readOnly } }} />
            </Grid>
            <Grid size={{ xs: 6 }}>
                <SelectElement name="tshirtFit" label="T-shirt fit" required size="small"
                               options={options.kTShirtFitOptions} fullWidth
                               slotProps={{ input: { readOnly } }} />
            </Grid>
            <Grid size={{ xs: 6 }}>
                <SelectElement name="includeCreditReel" label="Include in credit reel?" required
                               options={options.kBooleanOptions} size="small" fullWidth
                               slotProps={{ input: { readOnly } }} />
            </Grid>
            <Grid size={{ xs: 6 }}>
                <SelectElement name="includeSocialMedia" label="Include on social media?"
                               options={options.kBooleanOptions} size="small" fullWidth required
                               slotProps={{ input: { readOnly } }} />
            </Grid>
        </>
    );
}
