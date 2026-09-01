// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import Button from '@mui/material/Button';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';

import type { ServerAction } from '@lib/serverAction';
import { ResponsiveConfirmationDialog } from '@app/admin/components/ResponsiveConfirmationDialog';

/**
 * Props accepted by the <DeleteEnvironmentAction> component.
 */
interface DeleteEnvironmentActionProps {
    /**
     * Server action that should be invoked when deletion has been confirmed.
     */
    action: ServerAction;

    /**
     * Domain of the environment, to contextualise the confirmation prompt.
     */
    domain: string;
}

/**
 * Action through which an environment can be deleted, following user confirmation.
 */
export function DeleteEnvironmentAction(props: DeleteEnvironmentActionProps) {
    const { action, domain } = props;

    const [ dialogOpen, setDialogOpen ] = useState<boolean>(false);

    const handleDialogOpen = useCallback(() => setDialogOpen(true), [ /* no deps */ ]);
    const handleDialogClose = useCallback(() => setDialogOpen(false), [ /* no deps */ ]);

    return (
        <>
            <Button color="error" size="small" variant="outlined"
                    startIcon={ <DeleteOutlinedIcon /> } onClick={handleDialogOpen}>
                Delete this environment…
            </Button>
            <ResponsiveConfirmationDialog
                open={dialogOpen}
                onClose={handleDialogClose}
                action={action}
                confirmLabel="Delete"
                title="Delete this environment…">
                Are you sure you want to delete <strong>{domain}</strong>? This action is permanent
                and cannot be undone. All teams currently linked to this environment will need to be
                reassigned to a different one.
            </ResponsiveConfirmationDialog>
        </>
    );
}
