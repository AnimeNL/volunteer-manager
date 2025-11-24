// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useMemo, useState } from 'react';

import { TextareaAutosizeElement, useFormContext } from 'react-hook-form-mui';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

import type { ServerAction, ServerActionResult } from '@lib/serverAction';
import { FormGrid } from '@app/admin/components/FormGrid';

/**
 * Props accepted by the <ModelPlayground> component.
 */
interface ModelPlaygroundProps {
    /**
     * Whether to enable the ability to attach an image to the prompt.
     */
    enableAttachment?: boolean;

    /**
     * Label to give to the prompt input field.
     */
    label: string;

    /**
     * The model that should be used for executing the prompt.
     */
    model: 'image' | 'text';

    /**
     * The server action that should be executed to run the model.
     */
    serverAction: ServerAction;
}

/**
 * The <ModelPlayground> component is an interactive component through which a model can be tried
 * out. It supports two modes, text-only or text+image mode, depending on the model. The execution
 * will take place through a Server Action passed through props.
 */
export function ModelPlayground(props: ModelPlaygroundProps) {
    const [ generatedImage, setGeneratedImage ] = useState<unknown | undefined>();
    const [ generatedText, setGeneratedText ] = useState<string | undefined>();

    const defaultValues = useMemo(() => ({ model: props.model }), [ props.model ]);

    const executeModel = useCallback(async (formData: unknown): Promise<ServerActionResult> => {
        const result = await props.serverAction(formData);
        if (!result.success)
            return result;

        if ('generatedImage' in result) {
            setGeneratedImage(result.generatedImage);
            console.log(result.generatedImage);
        }
        if ('generatedText' in result)
            setGeneratedText(result.generatedText);

        return { success: true };

    }, [ props.serverAction ]);

    return (
        <>
            <FormGrid action={executeModel} callToAction="Execute" spacing={1}
                      defaultValues={defaultValues}>
                <Grid size={{ xs: 12 }}>
                    <ModelPlaygroundHiddenModelField />
                    <TextareaAutosizeElement
                        name="prompt" label={props.label} size="small" required fullWidth
                        sx={{ backgroundColor: 'background.paper' }} />
                </Grid>
                { props.enableAttachment &&
                    <Grid size={{ xs: 12 }}>
                        <ModelPlaygroundUploadButton />
                    </Grid> }
            </FormGrid>
            <Collapse in={!!generatedImage}>
                <Box sx={{ backgroundColor: 'background.paper', borderRadius: 1, p: 1, mt: 2 }}>
                    <Typography component="p" variant="subtitle2">
                        Gemini created:
                    </Typography>
                    <img src={`data:image/png;base64,${generatedImage}`} alt="AI Generated Image"
                         style={{ borderRadius: '2px', marginBottom: '-6px',  width: '100%' }} />
                </Box>
            </Collapse>
            <Collapse in={!!generatedText}>
                <Box sx={{ backgroundColor: 'background.paper', borderRadius: 1, p: 1, mt: 2 }}>
                    <Typography component="p" variant="subtitle2">
                        Gemini says:
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                        {generatedText}
                    </Typography>
                </Box>
            </Collapse>
        </>
    );
}

/**
 * Hidden input element that will register with RHF in order to communicate the type of model that
 * should be used with the server. Will additionally control parts of the response.
 */
function ModelPlaygroundHiddenModelField() {
    const { register } = useFormContext();
    return <input type="hidden" {...register('model')} />;
}

/**
 * Button that can be used to attach an image to the prompt. The button's label will change to the
 * name of the image when one has been selected. The field will be named "attachment".
 */
function ModelPlaygroundUploadButton() {
    const { register, watch } = useFormContext();

    const selectedFiles: undefined | FileList = watch('attachment');
    const selectedFileLabel = !!selectedFiles?.length ? selectedFiles[0].name : 'Attach image';

    return (
        <Button component="label" variant="outlined" startIcon={ <CloudUploadIcon /> } fullWidth>
            {selectedFileLabel}
            <VisuallyHiddenInput type="file" {...register('attachment')} accept="image/*" />
        </Button>
    );
}

/**
 * Input element that is hidden, but can overlap a regular button to allow for easy uploading of
 * a file. The selected file will only be uploaded to the server.
 *
 * @source https://mui.com/material-ui/react-button/#file-upload
 */
const VisuallyHiddenInput = styled('input')({
    clip: 'rect(0 0 0 0)',
    clipPath: 'inset(50%)',
    height: 1,
    overflow: 'hidden',
    position: 'absolute',
    bottom: 0,
    left: 0,
    whiteSpace: 'nowrap',
    width: 1,
});
