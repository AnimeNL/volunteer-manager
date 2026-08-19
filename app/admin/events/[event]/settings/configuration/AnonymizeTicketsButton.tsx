// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import Button from '@mui/material/Button';
import LinkOffIcon from '@mui/icons-material/LinkOff';

import type { ServerAction } from '@lib/serverAction';
import { ResponsiveConfirmationDialog } from '@app/admin/components/ResponsiveConfirmationDialog';

/**
 * Props accepted by the <AnonymizeTicketsButton> components.
 */
interface AnonymizeTicketsButtonProps {
    /**
     * The server action that should be invoked when anonymization has been confirmed.
     */
    action: ServerAction;
}

/**
 * The <AnonymizeTicketsButton> component enables administrators to anonymize information regarding
 * the visitor tickets we store once we no longer have an operational need, as required by the GDPR.
 */
export function AnonymizeTicketsButton(props: AnonymizeTicketsButtonProps) {
    const [ dialogOpen, setDialogOpen ] = useState<boolean>(false);

    const handleDialogOpen = useCallback(() => setDialogOpen(true), [ /* no dependencies */ ]);
    const handleDialogClose = useCallback(() => setDialogOpen(false), [ /* no dependencies */ ]);

    return (
        <>
            <Button size="small" variant="outlined" color="error" startIcon={ <LinkOffIcon /> }
                    onClick={handleDialogOpen}>
                Anonymize visitor tickets…
            </Button>
            <ResponsiveConfirmationDialog open={dialogOpen} onClose={handleDialogClose}
                                          action={props.action}
                                          title="Anonymize visitor tickets"
                                          confirmLabel="Anonymize">

                Anonymizing visitor tickets will permanently and irrevocably remove all personally
                identifiable information from such tickets from our system, in compliance with the
                GDPR. Don't proceed with anonymization until the festival has concluded.

            </ResponsiveConfirmationDialog>
        </>
    );
}
