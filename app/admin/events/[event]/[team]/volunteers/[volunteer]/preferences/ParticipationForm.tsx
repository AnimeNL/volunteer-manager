// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { SelectElement, TextFieldElement } from '@proxy/react-hook-form-mui';

import Grid from '@mui/material/Grid';

import { kBooleanOptions, kTShirtFitOptions, kTShirtSizeOptions }
    from '@components/SelectElementOptions';

/**
 * Props accepted by the <ParticipationForm> component.
 */
interface ParticipationFormProps {
    /**
     * Omits the dietary restrictions field when set to true.
     */
    disableDietary?: boolean;

    /**
     * Displays form fields in read-only mode.
     */
    readOnly?: boolean;
}

/**
 * Form to manage volunteer participation preferences.
 */
export function ParticipationForm(props: ParticipationFormProps) {
    const { readOnly } = props;
    return (
        <>
            <Grid size={{ xs: 6 }}>
                <SelectElement name="tshirtSize" label="T-shirt size" required size="small"
                               options={kTShirtSizeOptions} fullWidth
                               slotProps={{ input: { readOnly } }} />
            </Grid>
            <Grid size={{ xs: 6 }}>
                <SelectElement name="tshirtFit" label="T-shirt fit" required size="small"
                               options={kTShirtFitOptions} fullWidth
                               slotProps={{ input: { readOnly } }} />
            </Grid>
            <Grid size={{ xs: 6 }}>
                <SelectElement name="includeCreditReel" label="Include in credit reel?" required
                               options={kBooleanOptions} size="small" fullWidth
                               slotProps={{ input: { readOnly } }} />
            </Grid>
            <Grid size={{ xs: 6 }}>
                <SelectElement name="includeSocialMedia" label="Include on social media?"
                               options={kBooleanOptions} size="small" fullWidth required
                               slotProps={{ input: { readOnly } }} />
            </Grid>
            { !props.disableDietary &&
                <Grid size={{ xs: 12 }}>
                    <TextFieldElement name="dietary" label="Any dietary restrictions?" size="small"
                                      fullWidth multiline slotProps={{ input: { readOnly } }} />
                </Grid> }
        </>
    );
}
