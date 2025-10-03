// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import type React from 'react';
import { useCallback, useContext } from 'react';

import { type FieldValues, type FormContainerProps, useForm } from '@proxy/react-hook-form-mui';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Dialog, { type DialogProps } from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';

import type { ServerAction } from '@lib/serverAction';
import { FormProvider, FormProviderContext } from '@components/FormProvider';
import { Markdown } from '@components/Markdown';

/**
 * Types of content that can be rendered in the <SettingDialog> slots.
 */
type Content = string | React.ReactNode | React.ReactNode[];

/**
 * Props accepted by the <ServerActionDialog> component. May optionally be typed by TFieldValues,
 * which will propagate to the form container and settings contained herein.
 */
interface ServerActionDialogProps<TFieldValues extends FieldValues = FieldValues>
    extends Omit<InnerServerActionDialogProps, 'onClose'>
{
    /**
     * The server action that should be invoked to commit this action.
     */
    action: ServerAction;

    /**
     * Default values to prepopulate in the dialog. Optional.
     */
    defaultValues?: FormContainerProps<TFieldValues>['defaultValues'];

    /**
     * Optional maximum width that can be assigned to the dialog.
     */
    maxWidth?: DialogProps['maxWidth'];

    /**
     * Whether the dialog should be open.
     */
    open?: boolean;

    /**
     * To be called when the dialog is supposed to close.
     */
    onClose?: () => Promise<void> | void;
}

/**
 * The <ServerActionDialog> component encapsulates a canonical dialog through which a form can be
 * shown and committed straight to a server action.
 */
export function ServerActionDialog<TFieldValues extends FieldValues = FieldValues>(
    props: React.PropsWithChildren<ServerActionDialogProps<TFieldValues>>)
{
    const { action, children, defaultValues, maxWidth, open, onClose, ...innerProps } = props;
    const form = useForm();

    const handleClose = useCallback(async () => {
        try {
            await onClose?.();
        } finally {
            await new Promise(resolve => setTimeout(resolve, /* duration.standard= */ 300));
            form.reset();
        }
    }, [ form, onClose ]);

    return (
        <Dialog open={!!open} onClose={handleClose} fullWidth maxWidth={maxWidth}>
            <FormProvider action={action} defaultValues={defaultValues} form={form}>
                <InnerServerActionDialog {...innerProps} onClose={handleClose}>
                    {children}
                </InnerServerActionDialog>
            </FormProvider>
        </Dialog>
    );
}

/**
 * Props accepted by the <InnerServerActionDialog> component.
 */
interface InnerServerActionDialogProps {
    /**
     * Label to display on the close button. Defaults to "Close".
     */
    closeLabel?: string;

    /**
     * Description of the dialog. May either be a string or a ReactNode. Optional.
     */
    description?: Content;

    /**
     * Label to display on the submit button. Defaults to "Update".
     */
    submitLabel?: string;

    /**
     * Title of the dialog that should be displayed.
     */
    title: Content;

    /**
     * To be called when the dialog is supposed to close.
     */
    onClose: () => Promise<void>;
}

/**
 * The <InnerServerActionDialog> component provides the actual end-user functionality of the dialog,
 * tying in to both the form state and submission result which are conveyed through React Context.
 */
function InnerServerActionDialog(props: React.PropsWithChildren<InnerServerActionDialogProps>) {
    const { children, description, onClose, title } = props;

    const formContext = useContext(FormProviderContext);

    const closeLabel = props.closeLabel ?? 'Close';
    const submitLabel = props.submitLabel ?? 'Update';

    let errorMessage: React.ReactNode;
    if (formContext.result?.success === false) {
        errorMessage = (
            <Markdown defaultVariant="body2">{
                formContext.result.error || 'Something went wrong committing this action'
            }</Markdown>
        );
    }

    let successMessage: React.ReactNode;
    if (formContext.result?.success && 'message' in formContext.result) {
        successMessage = (
            <Markdown defaultVariant="body2">{formContext.result.message}</Markdown>
        );
    }

    return (
        <>
            <DialogTitle>
                {title}
            </DialogTitle>
            <DialogContent sx={{ overflowY: 'visible' }}>
                { description &&
                    <Typography>
                        {description}
                    </Typography> }
                {children}
                <Collapse in={!!formContext.result?.success}>
                    <Alert severity="success" sx={{ mt: 2 }}>
                        {successMessage}
                    </Alert>
                </Collapse>
                <Collapse in={formContext.result?.success === false}>
                    <Alert severity="error" sx={{ mt: 2 }}>
                        {errorMessage}
                    </Alert>
                </Collapse>
            </DialogContent>
            <DialogActions sx={{ pt: 0, mr: 2, mb: 2, pl: 2 }}>
                <Button onClick={onClose} variant="text">{closeLabel}</Button>
                <Button disabled={!!formContext.result?.success} loading={!!formContext.isPending}
                        variant="contained" type="submit">
                    {submitLabel}
                </Button>
            </DialogActions>
        </>
    );
}
