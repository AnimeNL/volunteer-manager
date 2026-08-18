// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import Button from '@mui/material/Button';
import LinkOffIcon from '@mui/icons-material/LinkOff';

import type { ServerAction } from '@lib/serverAction';
import { ResponsiveConfirmationDialog } from '@app/admin/components/ResponsiveConfirmationDialog';

/**
 * Props accepted by the <AnonymizeRefundsButton> components.
 */
interface AnonymizeRefundsButtonProps {
    /**
     * The server action that should be invoked when anonymization has been confirmed.
     */
    action: ServerAction;
}

/**
 * The <AnonymizeRefundsButton> component enables administrators to anonymize refund requests. This
 * ability remove all associated data from such requests, as required by European legislation.
 */
export function AnonymizeRefundsButton(props: AnonymizeRefundsButtonProps) {
    const [ dialogOpen, setDialogOpen ] = useState<boolean>(false);

    const handleDialogOpen = useCallback(() => setDialogOpen(true), [ /* no dependencies */ ]);
    const handleDialogClose = useCallback(() => setDialogOpen(false), [ /* no dependencies */ ]);

    return (
        <>
            <Button size="small" variant="outlined" color="error" startIcon={ <LinkOffIcon /> }
                    onClick={handleDialogOpen}>
                Anonymize refund requests…
            </Button>
            <ResponsiveConfirmationDialog open={dialogOpen} onClose={handleDialogClose}
                                          action={props.action}
                                          title="Anonymize refund requests"
                                          confirmLabel="Anonymize">

                Anonymizing refund requests will permanently and irrevocably remove all bank account
                details provided by volunteers from our system, in compliance with the GDPR. Don't
                proceed with anonymization until all refunds been processed.

            </ResponsiveConfirmationDialog>
        </>
    );
}
