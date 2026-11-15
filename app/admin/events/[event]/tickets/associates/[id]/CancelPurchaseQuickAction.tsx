// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';

import type { ServerAction } from '@lib/serverAction';
import { QuickActionButton } from '@app/admin/components/QuickActionButton';

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
    return (
        <QuickActionButton
            action={props.action}
            color="error"
            icon={ <CancelOutlinedIcon /> }
            label="Cancel purchase"
            submitColor="error"
            submitLabel="Cancel purchase"
            title="Cancel this purchase?"
            description={
                'Cancelling this purchase is permanent and cannot be undone. Doing so will ' +
                'revoke the ticket with our ticketing partner, and owners of any and all tickets ' +
                'within this purchase will not be notified of this action.'
            } />
    );
}
