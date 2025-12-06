// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useMemo, useState } from 'react';

import { SelectElement } from 'react-hook-form-mui';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';

import type { ServerAction } from '@lib/serverAction';
import { FormGrid } from '@app/admin/components/FormGrid';
import { GenerateButton } from '../../GenerateButton';
import { HiddenInput } from '@components/HiddenInput';
import { Markdown } from '@components/Markdown';

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
     * The server action that should be invoked when generating an example message.
     */
    action: ServerAction;

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
    const [ generatedMessage, setGeneratedMessage ] = useState<string | undefined>();

    const handleClose = useCallback(() => setGeneratedMessage(undefined), [ /* no deps */ ]);
    const handleSubmit = useCallback(async (formData: unknown) => {
        const response = await props.action(formData);
        if (response.success && 'message' in response)
            setGeneratedMessage(response.message);

        return response;

    }, [ props.action ]);

    const defaultValues = useMemo(() => ({
        id: props.id,
        language: 'English',
        personalisation: true,
    }), [ props.id ]);

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
                <HiddenInput name="id" />
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
            { !!generatedMessage &&
                <Dialog open onClose={handleClose} fullWidth>
                    <DialogTitle>
                        Generated message
                    </DialogTitle>
                    <DialogContent sx={{ whiteSpace: 'pre-line' }}>
                        <Markdown defaultVariant="body2">{generatedMessage}</Markdown>
                    </DialogContent>
                    <DialogActions sx={{ pt: 0, mr: 2, mb: 2 }}>
                        <Button onClick={handleClose} variant="text">Close</Button>
                    </DialogActions>
                </Dialog> }
        </Box>
    );
}
