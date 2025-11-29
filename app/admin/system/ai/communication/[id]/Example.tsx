// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { SelectElement } from 'react-hook-form-mui';

import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import Typography from '@mui/material/Typography';

import { FormGrid } from '@app/admin/components/FormGrid';

/**
 * Array of the supported languages. Gemini supports many more, but these ones are exposed.
 */
export const kSupportedLanguages = [
    'Chinese',
    'Dutch',
    'English',
    'French',
    'German',
    'Italian',
    'Japanese',
    'Korean',
    'Portuguese',
    'Spanish',
    'Turkish',

] as const;

/**
 * Props accepted by the <Example> component.
 */
interface ExampleProps {
    /**
     * Name of the prompt that this element provides an example for.
     */
    id: string;
}

/**
 * The <Example> component provides the ability to preview an example version of the saved prompt
 * by executing it on a model. It provides some basic interaction as the response becomes available.
 */
export function Example(props: ExampleProps) {
    async function handleSubmit() {
        return { success: false, error: 'yo' };
    }

    const defaultValues = {
        language: 'English',
        personalisation: true,
    };

    return (
        <FormGrid action={handleSubmit} defaultValues={defaultValues}>
            <Grid size={{ xs: 12 }} sx={{ mt: 2 }}>
                <Divider />
            </Grid>
            <Grid size={{ xs: 12 }} sx={{ mt: -1, mb: -1 }}>
                <Typography variant="h6">
                    Example
                </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
                <SelectElement name="language" label="Language" size="small" fullWidth
                               options={kSupportedLanguages.map(label => ({ id: label, label }))} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
                <SelectElement name="personalisation" label="Personalisation" size="small" fullWidth
                               options={[
                                   { id: true, label: 'Enabled' },
                                   { id: false, label: 'Disabled' },
                               ]} />
            </Grid>
            <Grid size={{ xs: 12 }}>
                <Button startIcon={ <SmartToyIcon /> } loading={false} type="submit" fullWidth
                        variant="outlined">
                    Generate message
                </Button>
            </Grid>
        </FormGrid>
    );
}
