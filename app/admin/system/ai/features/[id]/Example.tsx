// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useMemo, useState } from 'react';

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
    const [ generatedText, setGeneratedText ] = useState<string | undefined>();

    const handleClose = useCallback(() => setGeneratedText(undefined), [ /* no deps */ ]);
    const handleSubmit = useCallback(async (formData: unknown) => {
        const response = await props.action(formData);
        if (response.success && 'message' in response)
            setGeneratedText(response.message);

        return response;

    }, [ props.action ]);

    const defaultValues = useMemo(() => ({
        id: props.id,
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
            </FormGrid>
            { !!generatedText &&
                <Dialog open onClose={handleClose} fullWidth>
                    <DialogTitle>
                        Generated text
                    </DialogTitle>
                    <DialogContent sx={{ whiteSpace: 'pre-line' }}>
                        <Markdown defaultVariant="body2">{generatedText}</Markdown>
                    </DialogContent>
                    <DialogActions sx={{ pt: 0, mr: 2, mb: 2 }}>
                        <Button onClick={handleClose} variant="text">Close</Button>
                    </DialogActions>
                </Dialog> }
        </Box>
    );
}
