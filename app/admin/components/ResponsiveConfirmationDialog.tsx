// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { ResponsiveFormDialog, type ResponsiveFormDialogProps } from './ResponsiveFormDialog';

/**
 * Props accepted by the <ResponsiveConfirmationDialog> component.
 */
interface ResponsiveConfirmationDialogProps
    extends Pick<ResponsiveFormDialogProps, 'onClose' | 'open' | 'title'>
{
    /**
     * Colour to render the default button for confirming the action in.
     * @default "error"
     */
    confirmColor?: ResponsiveFormDialogProps['submitColor'];

    /**
     * Label to display on the confirm button.
     * @default "Confirm"
     */
    confirmLabel?: string;

    /**
     * Callback to invoke when the user has confirmed the operation.
     */
    onConfirm?: () => Promise<void> | void;
}

/**
 * The <ResponsiveConfirmationDialog> component is a device-appropriated mechanism for asking for
 * the user's confirmation prior to committing a certain action. It provides a simple, consistent
 * interface specific to this task.
 */
export function ResponsiveConfirmationDialog(
    props: React.PropsWithChildren<ResponsiveConfirmationDialogProps>)
{
    const { children, confirmColor, confirmLabel, onConfirm, ...responsiveFormDialogProps } = props;
    return (
        <ResponsiveFormDialog {...responsiveFormDialogProps}
                              description={children}
                              onSubmit={onConfirm}
                              submitColor={ confirmColor ?? 'error' }
                              submitLabel={ confirmLabel ?? 'Confirm' } />
    );
}
