// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import Tooltip from '@mui/material/Tooltip';

import { QrCode } from '@components/QrCode';
import { ResponsiveDialog } from '@app/admin/components/ResponsiveDialog';

/**
 * Props accepted by the <TicketQrAction> component.
 */
interface TicketQrActionProps {
    /**
     * Barcode to encode in the QR code.
     */
    barcode: string;

    /**
     * Title to display in the dialog header.
     */
    title: string;
}

/**
 * Header action button that opens a dialog displaying the ticket's QR code.
 */
export function TicketQrAction(props: TicketQrActionProps) {
    const [ open, setOpen ] = useState<boolean>(false);

    const handleClose = useCallback(() => setOpen(false), []);
    const handleOpen = useCallback(() => setOpen(true), []);

    return (
        <>
            <Tooltip title="Show QR code">
                <IconButton color="primary" size="small" onClick={handleOpen}>
                    <QrCode2Icon fontSize="small" />
                </IconButton>
            </Tooltip>
            <ResponsiveDialog
                open={open}
                onClose={handleClose}
                title={
                    <Box component="span" sx={{ display: 'block', textAlign: 'center' }}>
                        {props.title}
                    </Box>
                }>
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                    <Box sx={{ width: '100%', maxWidth: 320 }}>
                        <QrCode content={props.barcode} />
                    </Box>
                </Box>
            </ResponsiveDialog>
        </>
    );
}
