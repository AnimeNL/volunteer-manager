// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import QrCodeIcon from '@mui/icons-material/QrCode';

import { QrCode } from '@app/components/QrCode';
import { ResponsiveDialog } from '@app/admin/components/ResponsiveDialog';

/**
 * Props accepted by the <QrCodeAction> component.
 */
interface QrCodeActionProps {
    /**
     * Barcode to render on the QR code. The button will be hidden when omitted.
     */
    barcode?: string;
}

/**
 * The <QrCodeAction> component displays a device-appropriate interface through which the ticket's
 * QR code can be displayed, which can then be shared through a screenshot or other means.
 */
export function QrCodeAction(props: QrCodeActionProps) {
    const [ dialogOpen, setDialogOpen ] = useState<boolean>(false);

    const handleDialogClose = useCallback(() => setDialogOpen(false), []);
    const handleDialogOpen = useCallback(() => setDialogOpen(true), []);

    if (!props.barcode)
        return null;

    return (
        <>
            <Button startIcon={ <QrCodeIcon /> } size="small" variant="outlined"
                    onClick={handleDialogOpen}>
                QR code
            </Button>
            <ResponsiveDialog open={dialogOpen} onClose={handleDialogClose} title={undefined}>
                <Box sx={{ alignSelf: 'center', maxWidth: '50dvw' }}>
                    <QrCode content={props.barcode} />
                </Box>
            </ResponsiveDialog>
        </>
    );
}
