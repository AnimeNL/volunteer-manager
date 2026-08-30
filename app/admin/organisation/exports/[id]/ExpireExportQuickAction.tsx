// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import Button from '@mui/material/Button';
import UpdateDisabledIcon from '@mui/icons-material/UpdateDisabled';

import type { ServerAction } from '@lib/serverAction';
import { ResponsiveConfirmationDialog } from '@app/admin/components/ResponsiveConfirmationDialog';

/**
 * Props accepted by the <ExpireExportQuickAction> component.
 */
interface ExpireExportQuickActionProps {
    /**
     * The server action that should be invoked when expiring the export has been confirmed.
     */
    action: ServerAction;
}

/**
 * The <ExpireExportQuickAction> component allows administrators to expire an active data export,
 * revoking access immediately.
 */
export function ExpireExportQuickAction(props: ExpireExportQuickActionProps) {
    const [ dialogOpen, setDialogOpen ] = useState<boolean>(false);

    const handleDialogOpen = useCallback(() => setDialogOpen(true), [ /* no dependencies */ ]);
    const handleDialogClose = useCallback(() => setDialogOpen(false), [ /* no dependencies */ ]);

    return (
        <>
            <Button size="small" variant="outlined" color="error"
                    startIcon={ <UpdateDisabledIcon /> }
                    onClick={handleDialogOpen}>
                Expire this export…
            </Button>
            <ResponsiveConfirmationDialog open={dialogOpen} onClose={handleDialogClose}
                                          action={props.action}
                                          title="Expire this export"
                                          confirmLabel="Expire">
                Are you sure you want to revoke access to this export? Once you do, anyone with the
                link will no longer be able to view the exported data.
            </ResponsiveConfirmationDialog>
        </>
    );
}
