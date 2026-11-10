// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import Button from '@mui/material/Button';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';

import type { ServerAction } from '@lib/serverAction';
import { ResponsiveConfirmationDialog } from '@app/admin/components/ResponsiveConfirmationDialog';

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
}

/**
 * Action through which an e-mail account can be deleted, following user confirmation.
 */
export function DeleteEmailAccountAction(props: DeleteEmailAccountActionProps) {
    const { action, address } = props;

    const [ dialogOpen, setDialogOpen ] = useState<boolean>(false);

    const handleDialogOpen = useCallback(() => setDialogOpen(true), [ /* no deps */ ]);
    const handleDialogClose = useCallback(() => setDialogOpen(false), [ /* no deps */ ]);

    return (
        <>
            <Button color="error" size="small" variant="outlined"
                    startIcon={ <DeleteOutlinedIcon /> } onClick={handleDialogOpen}>
                Delete this account…
            </Button>
            <ResponsiveConfirmationDialog
                open={dialogOpen}
                onClose={handleDialogClose}
                action={action}
                confirmLabel="Delete"
                title="Delete this e-mail account…">
                Are you sure you want to delete <strong>{address}</strong>? It will no longer be
                available for sending or receiving messages.
            </ResponsiveConfirmationDialog>
        </>
    );
}
