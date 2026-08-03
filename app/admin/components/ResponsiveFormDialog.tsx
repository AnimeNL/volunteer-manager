// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { DefaultValues, FieldValues } from '@proxy/react-hook-form-mui';
import { FormContainer, useForm } from '@proxy/react-hook-form-mui';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';

import type { ServerAction } from '@lib/serverAction';
import { ResponsiveDialog, type ResponsiveDialogProps } from './ResponsiveDialog';

/**
 * Props accepted by the <ResponsiveFormDialog> component.
 */
export type ResponsiveFormDialogProps<T extends FieldValues = FieldValues> =
    Omit<ResponsiveDialogProps, 'Container' | 'ContainerProps' | 'additionalButtons' |
                                'additionalContent'> &
{
    /**
     * Default values that should be set to the form. Invalidations will propagate to the form.
     */
    defaultValues?: DefaultValues<T>;

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
} & (
    {
        /**
         * Server Action to invoke when the form is being submitted. The action's response will be
         * adhered to for server-driven behaviour such as state refreshes and redirects.
         */
        action?: never;

        /**
         * Callback to be invoked when the form is ready to be submitted.
         */
        onSubmit: (data: T) => Promise<void> | void;

    } |
    {
        /**
         * Server Action to invoke when the form is being submitted. The action's response will be
         * adhered to for server-driven behaviour such as state refreshes and redirects.
         */
        action: ServerAction<T>;

        /**
         * Callback to be invoked when the form is ready to be submitted.
         */
        onSubmit?: never;
    });

/**
 * Component that provides a responsive dialog interface appropriate for the device on which it's
 * being displayed. Wraps the component's contents in a form context.
 *
 * The following basic `<ResponsiveFormDialog>` example would invoke `handleSubmit` with an object
 * akin to `{ movie: "value" }`.
 *
 * @example
 *   <ResponsiveFormDialog open={open}
 *                         onClose={handleClose}
 *                         onSubmit={handleSubmit}
 *                         title="What is your favourite movie?">
 *       <TextFieldElement name="movie" label="Favourite movie" required />
 *   </ResponsiveFormDialog>
 */
export function ResponsiveFormDialog<T extends FieldValues = FieldValues>(
    props: React.PropsWithChildren<ResponsiveFormDialogProps<T>>)
{
    const { action, defaultValues, onSubmit, submitColor, submitLabel, ...responsiveDialogProps }
        = props;

    const [ error, setError ] = useState<string | undefined>();
    const [ confirmation, setConfirmation ] = useState<string | undefined>();
    const [ loading, setLoading ] = useState<boolean>(false);

    const formContext = useForm<T>({ defaultValues: defaultValues ?? {} as DefaultValues<T> });
    const formContextReset = formContext.reset;

    const router = useRouter();

    useEffect(() => {
        if (!props.open)
            return;

        formContextReset(defaultValues ? { ...defaultValues } : {} as DefaultValues<T>);

        setConfirmation(undefined);
        setError(undefined);
        setLoading(false);

    }, [ defaultValues, formContextReset, props.open ]);

    // ---------------------------------------------------------------------------------------------

    const handleSubmit = useCallback(async (data: FieldValues) => {
        setError(undefined);
        setLoading(true);
        try {
            const typedData = data as T;
            if (!!action) {
                const response = await action(typedData);
                if (!response.success)
                    throw new Error(response.error);

                if (!!response.close)
                    props.onClose?.();

                if (!!response.message)
                    setConfirmation(response.message);

                if (!!response.redirect)
                    router.push(response.redirect);

                if (!!response.refresh)
                    router.refresh();

            } else {
                await onSubmit?.(typedData);
            }
        } catch (error: any) {
            setError(error.message || 'An internal error has occurred');
        } finally {
            setLoading(false);
        }
    }, [ action, onSubmit, props.onClose, router ]);

    // ---------------------------------------------------------------------------------------------

    const ContainerProps = useMemo(() => ({
        defaultValues: defaultValues,
        formContext: formContext,
        onSuccess: handleSubmit,
    }), [ formContext, handleSubmit, defaultValues ]);

    return (
        <ResponsiveDialog closeLabel="Cancel"
                          {...responsiveDialogProps}
                          Container={FormContainer} ContainerProps={ContainerProps}
                          additionalContent={
                              <Collapse in={!!confirmation || !!error} sx={{ mt: '0 !important' }}>
                                  { !!confirmation &&
                                      <Alert severity="success" sx={{ marginTop: 2 }}>
                                          {confirmation}
                                      </Alert> }
                                  { !!error &&
                                      <Alert severity="error" sx={{ marginTop: 2 }}>
                                          {error}
                                      </Alert> }
                              </Collapse> }
                          additionalButtons={
                              <Button loading={loading} disabled={!!confirmation}
                                      variant="contained"
                                      color={submitColor || 'primary'} size="small"
                                      type="submit" autoFocus>
                                  { submitLabel || 'Submit' }
                              </Button>
                          } />
    );
}
