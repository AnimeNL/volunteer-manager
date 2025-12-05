// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { SelectElement } from 'react-hook-form-mui';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';

import { FormGrid } from '@app/admin/components/FormGrid';
import { GenerateButton } from '../../GenerateButton';

/**
 * Array of the supported languages. Gemini supports many more, but these ones are exposed.
 */
const kLanguages = [
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
        <Box sx={{
            backgroundColor: 'animecon.adminExampleBackground',
            borderRadius: 1,
            padding: 2,
            marginTop: 2,
        }}>
            <FormGrid action={handleSubmit} defaultValues={defaultValues}
                      submitButtonSlot={
                        <Grid size={{ xs: 12 }} sx={{ pb: 2 }}>
                            <GenerateButton />
                        </Grid> }>
                <Grid size={{ xs: 12, md: 6 }}>
                    <SelectElement name="language" label="Language" size="small" fullWidth
                                   sx={{ backgroundColor: 'background.paper' }}
                                   options={ kLanguages.map(label => ({ id: label, label }))} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <SelectElement name="personalisation" label="Personalisation" size="small"
                                   fullWidth sx={{ backgroundColor: 'background.paper' }}
                                   options={[
                                       { id: true, label: 'Use your example messages' },
                                       { id: false, label: 'Use generic example messages' },
                                   ]} />
                </Grid>
            </FormGrid>
        </Box>
    );
}
