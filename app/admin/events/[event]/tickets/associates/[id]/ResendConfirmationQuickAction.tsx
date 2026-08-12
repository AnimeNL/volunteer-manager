// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import Button from '@mui/material/Button';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';

import type { ServerAction } from '@lib/serverAction';
import { ResponsiveConfirmationDialog } from '@app/admin/components/ResponsiveConfirmationDialog';

/**
 * Props accepted by the <ResendConfirmationQuickAction> component.
 */
interface ResendConfirmationQuickActionProps {
    /**
     * Server Action through which the ticket e-mail can be resend.
     */
    action: ServerAction<{ /* none */ }>;
}

/**
 * The <ResendConfirmationQuickAction> component allows requesting the ticketing partner to re-send
 * the e-mail they confirm the successful purchase with, in case the owner loses it.
 */
export function ResendConfirmationQuickAction(props: ResendConfirmationQuickActionProps) {
    const [ dialogOpen, setDialogOpen ] = useState<boolean>(false);

    const handleDialogClose = useCallback(() => setDialogOpen(false), []);
    const handleDialogOpen = useCallback(() => setDialogOpen(true), []);

    return (
        <>
            <Button startIcon={ <EmailOutlinedIcon /> } size="small" variant="outlined"
                    color="inherit" onClick={handleDialogOpen}>
                Resend confirmation
            </Button>
            <ResponsiveConfirmationDialog
                open={dialogOpen}
                onClose={handleDialogClose}
                action={props.action}
                confirmColor="success"
                confirmLabel="Send e-mail"
                title="Resend ticket confirmation?">

                The ticket's recipient will receive another e-mail from our ticketing partner with
                information about their ticket. Most of our volunteers will be able to access this
                directly from the Volunteer Portal.

            </ResponsiveConfirmationDialog>
        </>
    );
}
