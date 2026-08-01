// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { DefaultValues, FieldValues } from '@proxy/react-hook-form-mui';
import { FormContainer, useForm } from '@proxy/react-hook-form-mui';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';

import { ResponsiveDialog, type ResponsiveDialogProps } from './ResponsiveDialog';

/**
 * Props accepted by the <ResponsiveFormDialog> component.
 */
export interface ResponsiveFormDialogProps<T extends FieldValues = FieldValues>
    extends Omit<ResponsiveDialogProps, 'Container' | 'ContainerProps' | 'additionalButtons' |
                                        'additionalContent'>
{
    /**
     * Default values that should be set to the form. Invalidations will propagate to the form.
     */
    defaultValues?: DefaultValues<T>;

    /**
     * Callback to be invoked when the form is ready to be submitted.
     */
    onSubmit?: (data: T) => Promise<void> | void;

    /**
     * Colour to render the default button for submitting the form in.
     * @default "primary"
     */
    submitColor?: 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';

    /**
     * Label to render on the default button for submitting the form.
     * @default "Submit"
     */
    submitLabel?: string;
}

/**
 * Component that provides a responsive dialog interface appropriate for the device on which it's
 * being displayed. Wraps the component's contents in a form context.
 */
export function ResponsiveFormDialog(props: React.PropsWithChildren<ResponsiveFormDialogProps>) {
    const { defaultValues, onSubmit, submitColor, submitLabel, ...responsiveDialogProps } = props;

    const [ error, setError ] = useState<string | undefined>();
    const [ loading, setLoading ] = useState<boolean>(false);

    const formContext = useForm({ defaultValues: defaultValues ?? { /* none */ } });
    const formContextReset = formContext.reset;

    useEffect(() => {
        if (!props.open)
            return;

        formContextReset(defaultValues ? { ...defaultValues } : {});

        setError(undefined);
        setLoading(false);

    }, [ defaultValues, formContextReset, props.open ]);

    // ---------------------------------------------------------------------------------------------

    const handleSubmit = useCallback(async (data: FieldValues) => {
        setError(undefined);
        setLoading(true);
        try {
            await onSubmit?.(data);
        } catch (error: any) {
            setError(error.message || 'An internal error has occurred');
        } finally {
            setLoading(false);
        }
    }, [ onSubmit ]);

    // ---------------------------------------------------------------------------------------------

    const ContainerProps = useMemo(() => ({
        defaultValues: defaultValues,
        onSuccess: handleSubmit,
    }), [ handleSubmit, defaultValues ]);

    return (
        <ResponsiveDialog closeLabel="Cancel"
                          {...responsiveDialogProps}
                          Container={FormContainer} ContainerProps={ContainerProps}
                          additionalContent={
                              <Collapse in={!!error} sx={{ margin: '0 -8px 0 -8px !important' }}>
                                  <Alert severity="error" sx={{ marginTop: 2 }}>
                                      {error}
                                  </Alert>
                              </Collapse> }
                          additionalButtons={
                              <Button onClick={handleSubmit} loading={loading} variant="contained"
                                      color={submitColor || 'primary'} size="small"
                                      type="submit" autoFocus>
                                  { submitLabel || 'Submit' }
                              </Button>
                          } />
    );
}
