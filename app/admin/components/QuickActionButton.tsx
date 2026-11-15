// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import type { DefaultValues, FieldValues } from '@proxy/react-hook-form-mui';

import Button, { type ButtonProps } from '@mui/material/Button';

import type { ServerAction } from '@lib/serverAction';
import { ResponsiveFormDialog, type ResponsiveFormDialogProps } from './ResponsiveFormDialog';

/**
 * Props accepted by the <QuickActionButton> component.
 */
interface QuickActionButtonProps<T extends FieldValues = FieldValues> {
    /**
     * Server Action to invoke when the dialog is submitted.
     */
    action: ServerAction<T>;

    /**
     * Colour of the trigger button.
     * @default "inherit"
     */
    color?: ButtonProps['color'];

    /**
     * Default values for the form inside the dialog, if any.
     */
    defaultValues?: DefaultValues<T>;

    /**
     * Description text or markup displayed inside the dialog.
     */
    description?: React.ReactNode;

    /**
     * Icon displayed at the start of the trigger button.
     */
    icon: React.ReactNode;

    /**
     * Label displayed on the trigger button.
     */
    label: string;

    /**
     * Colour of the dialog's submit button.
     * @default "primary"
     */
    submitColor?: ResponsiveFormDialogProps<T>['submitColor'];

    /**
     * Label displayed on the dialog's submit button.
     * @default "Submit"
     */
    submitLabel?: string;

    /**
     * Title displayed at the top of the dialog.
     */
    title: string;
}

/**
 * The <QuickActionButton> component renders an outlined action button that opens a
 * <ResponsiveFormDialog> when clicked, encapsulating the open/close dialog state.
 */
export function QuickActionButton<T extends FieldValues = FieldValues>(
    props: React.PropsWithChildren<QuickActionButtonProps<T>>)
{
    const [ dialogOpen, setDialogOpen ] = useState<boolean>(false);

    const handleDialogClose = useCallback(() => setDialogOpen(false), []);
    const handleDialogOpen = useCallback(() => setDialogOpen(true), []);

    return (
        <>
            <Button startIcon={props.icon} size="small" variant="outlined"
                    color={props.color ?? 'inherit'} onClick={handleDialogOpen}>
                {props.label}
            </Button>
            <ResponsiveFormDialog
                open={dialogOpen}
                onClose={handleDialogClose}
                action={props.action}
                defaultValues={props.defaultValues}
                title={props.title}
                submitColor={props.submitColor}
                submitLabel={props.submitLabel}
                description={props.description}>
                {props.children}
            </ResponsiveFormDialog>
        </>
    );
}
