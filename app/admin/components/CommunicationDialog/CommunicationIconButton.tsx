// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import Badge from '@mui/material/Badge';
import EmailIcon from '@mui/icons-material/Email';
import IconButton from '@mui/material/IconButton';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import Tooltip from '@mui/material/Tooltip';

import type { CommunicationPromptId } from '@lib/ai/PromptFactory';
import { CommunicationDialog, type CommunicationDialogProps } from './CommunicationDialog';

/**
 * Props accepted by the <CommunicationIconButton> component.
 */
type CommunicationIconButtonProps<T extends CommunicationPromptId = CommunicationPromptId> =
    Omit<CommunicationDialogProps<T>, 'onClose' | 'open'> & {
    /**
     * Which badge to display on top of the button, if any. "check" will display a small checked
     * icon in the button's corner, whereas "warning" will display an orange attention sign.
     *
     * @default "none"
     */
    badge?: 'check' | 'none' | 'warning';

    /**
     * Whether the button should be disabled. No description or tooltip will be available.
     */
    disabled?: boolean;

    /**
     * Size of the button and the icon contained therein.
     *
     * @default "small"
     */
    size?: 'small' | 'medium' | 'large';

    /**
     * Message to display on the button's tooltip, to indicate to the user what happens when they
     * activate the button.
     *
     * @default "Send an e-mail…"
     */
    tooltip?: string;
}

/**
 * The <CommunicationIconButton> component displays an <IconButton> with an e-mail icon and
 * optionally a badge that, upon being activated, will start the <CommunicationDialog> flow.
 *
 * The dialog will only be mounted when the button has been clicked at least once, under the
 * assumption that more than a single button is likely to be displayed on each page.
 */
export function CommunicationIconButton<T extends CommunicationPromptId = CommunicationPromptId>(
    props: React.PropsWithChildren<CommunicationIconButtonProps<T>>)
{
    let { badge, disabled, size, tooltip, ...communicationDialogProps } = props;

    badge ??= 'none';
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
            <Tooltip title={ tooltip ?? 'Send an e-mail…' }>
                <IconButton disabled={disabled} onClick={handleOpen} size={size}>
                    { badge === 'check' &&
                        <MarkEmailReadIcon color="primary" fontSize={size} /> }
                    { badge === 'none' &&
                        <EmailIcon color="primary" fontSize={size} /> }
                    { badge === 'warning' &&
                        <Badge color="warning" variant="dot">
                            <EmailIcon color="primary" fontSize={size} />
                        </Badge> }
                </IconButton>
            </Tooltip>
            { !!openCounter &&
                <CommunicationDialog key={openCounter} {...communicationDialogProps as any}
                                     onClose={handleClose} open={open}>
                    {props.children}
                </CommunicationDialog> }
        </>
    );
}
