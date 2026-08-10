// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import Button from '@mui/material/Button';
import PersonRemoveOutlinedIcon from '@mui/icons-material/PersonRemoveOutlined';

import type { ServerAction } from '@lib/serverAction';
import { ResponsiveFormDialog } from '@app/admin/components/ResponsiveFormDialog';

/**
 * Props accepted by the <DisassociateQuickAction> component.
 */
interface DisassociateQuickActionProps {
    /**
     * Server Action through which the association can be created.
     */
    action: ServerAction;
}

/**
 * The <DisassociateQuickAction> component allows a ticket to be disassociated from the volunteer
 * that currently "owns" it. The ticket will be returned to the externals pool afterwards.
 */
export function DisassociateQuickAction(props: DisassociateQuickActionProps) {
    const [ dialogOpen, setDialogOpen ] = useState<boolean>(false);

    const handleDialogClose = useCallback(() => setDialogOpen(false), []);
    const handleDialogOpen = useCallback(() => setDialogOpen(true), []);

    return (
        <>
            <Button startIcon={ <PersonRemoveOutlinedIcon /> } size="small" variant="outlined"
                    color="inherit" onClick={handleDialogOpen}>
                Disassociate
            </Button>
            <ResponsiveFormDialog
                open={dialogOpen}
                onClose={handleDialogClose}
                action={props.action}
                title="Disassociate this ticket?"
                submitLabel="Disassociate"
                description={
                    <>
                        This action will return the ticket to the <em>externals</em> pool—it may
                        continue to be valid for entry, but won't be associated with this volunteer
                        anymore.
                    </>
                } />
        </>
    );
}
