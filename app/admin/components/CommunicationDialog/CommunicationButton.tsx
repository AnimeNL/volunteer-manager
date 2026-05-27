// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import Button from '@mui/material/Button';

import type { CommunicationPromptId } from '@lib/ai/PromptFactory';
import { CommunicationDialog, type CommunicationDialogProps } from './CommunicationDialog';

/**
 * Props accepted by the <CommunicationButton> component.
 */
type CommunicationButtonProps<T extends CommunicationPromptId = CommunicationPromptId> =
    Omit<CommunicationDialogProps<T>, 'onClose' | 'open'> & {
    /**
     * Whether the button should be disabled.
     */
    disabled?: boolean;

    /**
     * Label to display on the button.
     */
    label: string;

    /**
     * Size of the button.
     *
     * @default "small"
     */
    size?: 'small' | 'medium' | 'large';
}

/**
 * The <CommunicationButton> component displays a <Button> that, upon being activated, will start
 * the <CommunicationDialog> flow. Various props are available to customise the appearance.
 *
 * The dialog will only be mounted when the button has been clicked at least once, under the
 * assumption that more than a single button is likely to be displayed on each page.
 */
export function CommunicationButton<T extends CommunicationPromptId = CommunicationPromptId>(
    props: React.PropsWithChildren<CommunicationButtonProps<T>>)
{
    let { disabled, label, size, ...communicationDialogProps } = props;

    size ??= 'small';

    const [ openCounter, setOpenCounter ] = useState<number>(0);
    const [ open, setOpen ] = useState<boolean>(false);

    const handleClose = useCallback(() => setOpen(false), [ /* no deps */ ]);
    const handleOpen = useCallback(() => {
        setOpenCounter(n => n + 1);
        setOpen(true);
    }, [ /* no deps */ ]);

    return (
        <>
            <Button disabled={disabled} onClick={handleOpen} size={size}>
                {label}
            </Button>
            { !!openCounter &&
                <CommunicationDialog key={openCounter} {...communicationDialogProps as any}
                                     onClose={handleClose} open={open}>
                    {props.children}
                </CommunicationDialog> }
        </>
    );
}
