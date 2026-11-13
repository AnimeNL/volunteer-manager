// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import DeleteIcon from '@mui/icons-material/Delete';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

import type { ServerAction } from '@lib/serverAction';
import { ResponsiveConfirmationDialog } from '@app/admin/components/ResponsiveConfirmationDialog';
import { TooltipIconWrapper } from '@components/TooltipIconWrapper';

/**
 * Props accepted by the <DeleteEmailAccountAction> component.
 */
interface DeleteEmailAccountActionProps {
    /**
     * Server action that should be invoked when deletion has been confirmed.
     */
    action: ServerAction;

    /**
     * Address of the e-mail account, to contextualise the confirmation prompt.
     */
    address: string;

    /**
     * Whether deleting this e-mail account should be disabled.
     */
    disabled?: boolean;
}

/**
 * Action through which an e-mail account can be deleted, following user confirmation.
 */
export function DeleteEmailAccountAction(props: DeleteEmailAccountActionProps) {
    const { action, address, disabled } = props;

    const [ dialogOpen, setDialogOpen ] = useState<boolean>(false);

    const handleDialogOpen = useCallback(() => setDialogOpen(true), [ /* no deps */ ]);
    const handleDialogClose = useCallback(() => setDialogOpen(false), [ /* no deps */ ]);

    if (disabled) {
        return (
            <Tooltip title="This account cannot be deleted">
                <TooltipIconWrapper>
                    <IconButton disabled size="small">
                        <DeleteIcon color="disabled" fontSize="small" />
                    </IconButton>
                </TooltipIconWrapper>
            </Tooltip>
        );
    }

    return (
        <>
            <Tooltip title="Delete this account…">
                <IconButton onClick={handleDialogOpen} size="small">
                    <DeleteIcon color="error" fontSize="small" />
                </IconButton>
            </Tooltip>
            <ResponsiveConfirmationDialog
                open={dialogOpen}
                onClose={handleDialogClose}
                action={action}
                confirmLabel="Delete"
                title="Delete this e-mail account?">
                Are you sure you want to delete <strong>{address}</strong>? It will no longer be
                available for sending or receiving messages.
            </ResponsiveConfirmationDialog>
        </>
    );
}
