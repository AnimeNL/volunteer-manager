// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import Button from '@mui/material/Button';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';

import type { ServerAction } from '@lib/serverAction';
import { ResponsiveConfirmationDialog } from '@app/admin/components/ResponsiveConfirmationDialog';

/**
 * Props accepted by the <CancelPurchaseQuickAction> component.
 */
interface CancelPurchaseQuickActionProps {
    /**
     * Server Action through which the purchase can be cancelled.
     */
    action: ServerAction<{ /* none */ }>;
}

/**
 * The <CancelPurchaseQuickAction> component allows a ticket purchase to be cancelled. This will
 * immediately invalidate the ticket with our ticketing partner, and cannot be undone.
 */
export function CancelPurchaseQuickAction(props: CancelPurchaseQuickActionProps) {
    const [ dialogOpen, setDialogOpen ] = useState<boolean>(false);

    const handleDialogClose = useCallback(() => setDialogOpen(false), []);
    const handleDialogOpen = useCallback(() => setDialogOpen(true), []);

    return (
        <>
            <Button startIcon={ <CancelOutlinedIcon /> } size="small" variant="outlined"
                    color="error" onClick={handleDialogOpen}>
                Cancel purchase
            </Button>
            <ResponsiveConfirmationDialog
                open={dialogOpen}
                onClose={handleDialogClose}
                action={props.action}
                confirmLabel="Cancel purchase"
                title="Cancel this purchase?">

                Cancelling this purchase is permanent and cannot be undone. Doing so will revoke the
                ticket with our ticketing partner, and owners of any and all tickets within this
                purchase will not be notified of this action.

            </ResponsiveConfirmationDialog>
        </>
    );
}
