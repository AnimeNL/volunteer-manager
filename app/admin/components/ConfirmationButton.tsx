// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import type React from 'react';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import Button, { type ButtonProps } from '@mui/material/Button';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import Typography from '@mui/material/Typography';

import type { ServerAction } from '@lib/serverAction';
import { ConfirmationDialog } from './ConfirmationDialog';

/**
 * Props accepted by the <ConfirmationButton> component.
 */
interface ConfirmationButtonProps {
    /**
     * Server Action that should be invoked when confirmation has been received.
     */
    action: ServerAction;

    /**
     * Text that should be displayed on the call to action button. Defaults to "Delete".
     */
    callToAction?: string;

    /**
     * Colour that the confirmation button should be rendered in. Defaults to "error".
     */
    color?: 'error' | 'info' | 'success';

    /**
     * The icon that should be shown on the button. Defaults to <DeleteOutlineIcon />.
     */
    icon?: React.ReactNode;

    /**
     * Label that should be rendered on the button.
     */
    label: string;

    /**
     * Custom styles that should be applied to the inner button.
     */
    sx?: ButtonProps['sx'];
}

/**
 * The <ConfirmationButton> component displays an outlined button which, when clicked on, shows a
 * confirmation dialog that the action should indeed take place. When this has been confirmed, the
 * passed server action will be executed.
 */
export function ConfirmationButton(props: React.PropsWithChildren<ConfirmationButtonProps>) {
    const { action, label } = props;

    const callToAction = props.callToAction ?? 'Delete';
    const color = props.color ?? 'error';
    const icon = props.icon ?? <DeleteOutlineIcon />;

    const router = useRouter();

    const [ open, setOpen ] = useState<boolean>(false);

    const handleRequestConfirm = useCallback(() => setOpen(true), [ /* no dependencies */ ]);
    const handleConfirm = useCallback(async () => {
        const result = await action(new FormData);
        if (!result.success)
            return { error: result.error };

        if (!!result.redirect) {
            router.push(result.redirect);
            return true;
        }

        if (!!result.refresh) {
            router.refresh();
            return true;
        }

        return true;

    }, [ action, router ]);

    return (
        <>
            <Button color={color} size="small" variant="outlined" endIcon={icon}
                    onClick={handleRequestConfirm} sx={props.sx}>
                {props.label}
            </Button>
            { open &&
                <ConfirmationDialog confirmLabel={callToAction} title={label} open
                                    onClose={ () => setOpen(false) } onConfirm={handleConfirm}>
                    <Typography variant="body1">
                        {props.children}
                    </Typography>
                </ConfirmationDialog> }
        </>
    );
}
