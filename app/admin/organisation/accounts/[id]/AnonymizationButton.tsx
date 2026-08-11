// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import Button from '@mui/material/Button';
import LinkOffIcon from '@mui/icons-material/LinkOff';

import type { ServerAction } from '@lib/serverAction';
import { ResponsiveConfirmationDialog } from '@app/admin/components/ResponsiveConfirmationDialog';

/**
 * Props accepted by the <AnonymizationButton> components.
 */
interface AnonymizationButtonProps {
    /**
     * The server action that should be invoked when anonymization has been confirmed.
     */
    action: ServerAction;

    /**
     * Name of the account that is about to by anonymized.
     */
    name: string;
}

/**
 * The <AnonymizationButton> component enables administrators to anonymize accounts. This ability
 * provides the ability to remove all associated account data, as required by European legislation.
 */
export function AnonymizationButton(props: AnonymizationButtonProps) {
    const [ dialogOpen, setDialogOpen ] = useState<boolean>(false);

    const handleDialogOpen = useCallback(() => setDialogOpen(true), [ /* no dependencies */ ]);
    const handleDialogClose = useCallback(() => setDialogOpen(false), [ /* no dependencies */ ]);

    return (
        <>
            <Button size="small" variant="outlined" color="error" startIcon={ <LinkOffIcon /> }
                    onClick={handleDialogOpen}>
                Anonymize this account…
            </Button>
            <ResponsiveConfirmationDialog open={dialogOpen} onClose={handleDialogClose}
                                          action={props.action}
                                          title="Anonymize this account"
                                          confirmLabel="Anonymize">

                Anonymizing this account will permanently and irrevocably remove all personally
                identifiable information related to <strong>{props.name}</strong> from our system,
                in compliance with the GDPR.

            </ResponsiveConfirmationDialog>
        </>
    );
}
