// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import type { ServerAction } from '@lib/serverAction';
import { ResponsiveFormDialog, type ResponsiveFormDialogProps } from './ResponsiveFormDialog';

/**
 * Props accepted by the <ResponsiveConfirmationDialog> component.
 */
type ResponsiveConfirmationDialogProps =
    Pick<ResponsiveFormDialogProps, 'onClose' | 'open' | 'title'> &
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

    } & ({
        /**
         * Server Action to invoke when the confirmation has been obtained. The action's response
         * will be adhered to for server-driven behaviour such as state refreshes and redirects.
         */
        action?: never;

        /**
         * Callback to be invoked when the confirmation has been obtained.
         */
        onConfirm: () => Promise<void> | void;

    } | {
        /**
         * Server Action to invoke when the confirmation has been obtained. The action's response
         * will be adhered to for server-driven behaviour such as state refreshes and redirects.
         */
        action: ServerAction<any>;

        /**
         * Callback to be invoked when the confirmation has been obtained.
         */
        onConfirm?: never;
    });

/**
 * The <ResponsiveConfirmationDialog> component is a device-appropriated mechanism for asking for
 * the user's confirmation prior to committing a certain action. It provides a simple, consistent
 * interface specific to this task.
 */
export function ResponsiveConfirmationDialog(
    props: React.PropsWithChildren<ResponsiveConfirmationDialogProps>)
{
    const {
        children,
        confirmColor,
        confirmLabel,
        onConfirm,
        action,
        ...responsiveFormDialogProps
    } = props;

    const confirmColorWithDefault = confirmColor ?? 'error';
    const confirmLabelWithDefault = confirmLabel ?? 'Confirm';

    if (action) {
        return (
            <ResponsiveFormDialog {...responsiveFormDialogProps}
                                   action={action}
                                   description={children}
                                   submitColor={confirmColorWithDefault}
                                   submitLabel={confirmLabelWithDefault} />
        );
    } else {
        return (
            <ResponsiveFormDialog {...responsiveFormDialogProps}
                                   onSubmit={onConfirm!}
                                   description={children}
                                   submitColor={confirmColorWithDefault}
                                   submitLabel={confirmLabelWithDefault} />
        );
    }
}
