// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';

import type { ServerAction } from '@lib/serverAction';
import { QuickActionButton } from '@app/admin/components/QuickActionButton';

/**
 * Props accepted by the purchase quick action components.
 */
interface PurchaseQuickActionProps {
    /**
     * Server Action to invoke when the quick action is confirmed.
     */
    action: ServerAction<{ /* none */ }>;
}

/**
 * Allows a ticket purchase to be cancelled. This will immediately invalidate the ticket with our
 * ticketing partner, and cannot be undone.
 */
export function CancelPurchaseQuickAction(props: PurchaseQuickActionProps) {
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

/**
 * Allows requesting the ticketing partner to re-send the e-mail they confirm the successful
 * purchase with, in case the owner loses it.
 */
export function ResendConfirmationQuickAction(props: PurchaseQuickActionProps) {
    return (
        <QuickActionButton
            action={props.action}
            icon={ <EmailOutlinedIcon /> }
            label="Resend confirmation"
            submitColor="success"
            submitLabel="Send e-mail"
            title="Resend ticket confirmation?"
            description={
                "The ticket's recipient will receive another e-mail from our ticketing partner " +
                'with information about their ticket. Most of our volunteers will be able to ' +
                'access this directly from the Volunteer Portal.'
            } />
    );
}
