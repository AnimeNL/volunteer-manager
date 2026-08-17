// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useContext } from 'react';

import Alert from '@mui/material/Alert';
import Box, { type BoxProps } from '@mui/material/Box';
import Button, { type ButtonProps } from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';

import { FormProviderContext } from '@components/FormProvider';

/**
 * Props accepted by the <FormSubmitButton> component.
 */
interface FormSubmitButtonProps extends Omit<ButtonProps, 'loading' | 'sx'> {
    /**
     * Text to display on the submit button, defaults to "Save changes"
     */
    callToAction?: string;

    /**
     * Styling rules to apply to the <Box> surrounding the submit button, not the button itself.
     */
    sx?: BoxProps['sx'];
}

/**
 * The <FormSubmitButton> component displays a submit button that can be used on one of our content
 * pages. It will be appropriately styled to the environment, and has the ability to display both
 * warning and error messages in case these are detected.
 *
 * The <FormSubmitButton> component must have a <FormProvider> component somewhere in its ancestry,
 * in order to hook into the right information to function properly.
 */
export function FormSubmitButton(props: FormSubmitButtonProps) {
    const { callToAction, sx, ...buttonProps } = props;

    const formContext = useContext(FormProviderContext);
    const formError = !!formContext.result && !formContext.result.success;
    const formMessage =
        !!formContext.result && !!formContext.result.success && !!formContext.result.message;

    return (
        <Box sx={sx}>
            <Collapse in={formError}>
                <Alert severity="error" sx={{ mb: 2 }}>
                    { formContext.result?.error || 'The changes could not be saved' }
                </Alert>
            </Collapse>
            <Collapse in={formMessage}>
                <Alert severity="success" sx={{ mb: 2 }}>
                    { !!formContext.result?.success && formContext.result.message }
                </Alert>
            </Collapse>
            <Button variant="contained" type="submit" {...buttonProps}
                    loading={!!formContext.isPending}>
                { callToAction ?? 'Save changes' }
            </Button>
        </Box>
    );
}
