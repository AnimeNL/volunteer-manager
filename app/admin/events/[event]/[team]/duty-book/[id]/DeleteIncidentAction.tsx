// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import DeleteIcon from '@mui/icons-material/Delete';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

import type { ServerAction } from '@lib/serverAction';
import { ResponsiveConfirmationDialog } from '@app/admin/components/ResponsiveConfirmationDialog';

/**
 * Props accepted by the <DeleteIncidentAction> component.
 */
interface DeleteIncidentActionProps {
    /**
     * The action that should be committed when the user confirms deletion.
     */
    action: ServerAction;
}

/**
 * Action through which an incident can be removed, following user confirmation.
 */
export function DeleteIncidentAction(props: DeleteIncidentActionProps) {
    const [ dialogOpen, setDialogOpen ] = useState<boolean>(false);

    const handleDialogClose = useCallback(() => setDialogOpen(false), [ ]);
    const handleDialogOpen = useCallback(() => setDialogOpen(true), [ ]);

    return (
        <>
            <IconButton onClick={handleDialogOpen} size="small">
                <Tooltip title="Delete this incident…">
                    <DeleteIcon color="error" fontSize="small" />
                </Tooltip>
            </IconButton>
            <ResponsiveConfirmationDialog open={dialogOpen} onClose={handleDialogClose}
                                          action={props.action} confirmLabel="Delete"
                                          title="Delete this incident?">
                Delete this incident report only if it was created by mistake. If the report
                contains personally identifiable or sensitive information, please restrict its
                access instead of deleting it.
            </ResponsiveConfirmationDialog>
        </>
    );
}
