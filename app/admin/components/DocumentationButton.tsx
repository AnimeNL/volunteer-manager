// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';
import { useQueryState, parseAsBoolean } from 'nuqs';

import type { SvgIconProps } from '@mui/material/SvgIcon';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

/**
 * Lazily loaded variant of the <DocumentationDialog> component.
 */
const DocumentationDialog = dynamic(() => import('./DocumentationDialog'), { ssr: false });

/**
 * Props accepted by the <DocumentationButton> component.
 */
interface DocumentationButtonProps {
    /**
     * Colour in which the documentation button should be displayed.
     */
    color?: SvgIconProps['color'];

    /**
     * Size in which the button should be displayed.
     */
    size?: 'small' | 'medium' | 'large';

    /**
     * Topic that should be shown in the dialog.
     */
    topic: string;
}

/**
 * The <DocumentationButton> component displays a button that can be used to open the documentation
 * dialog on a particular topic. The documentation will be readable for everyone, and can be updated
 * using the regular content management tool in the administration interface.
 */
export function DocumentationButton(props: DocumentationButtonProps) {
    const size = props.size ?? 'medium';

    // Whether the dialog has been requested to be shown at least once. The dialog functionality is
    // lazily included on the page, as it's not a common feature that everyone will use.
    const [ dialogRequested, setDialogRequested ] = useState<boolean>(false);

    // Whether the dialog is currently open. This will be toggled by the user's interaction.
    const [ dialogOpen, setDialogOpen ] = useQueryState('help', parseAsBoolean.withDefault(false));

    // Handles the user's request to close the documentation dialog.
    const handleCloseDocumentation = useCallback(() => {
        setDialogOpen(false);
    }, [ setDialogOpen ]);

    // Handles the user's request to show the documentation dialog.
    const handleShowDocumentation = useCallback(() => {
        setDialogOpen(true);
        setDialogRequested(true);
    }, [ setDialogOpen ]);

    return (
        <>
            <Tooltip title="Learn more">
                <IconButton onClick={handleShowDocumentation} size={size}>
                    <HelpOutlineIcon color={props.color} fontSize={size} />
                </IconButton>
            </Tooltip>
            { dialogRequested &&
                <DocumentationDialog onClose={handleCloseDocumentation} open={dialogOpen}
                                     topic={props.topic} /> }
        </>
    );
}
