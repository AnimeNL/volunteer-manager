// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';

/**
 * Props accepted by the <SettingsDialog> component.
 */
export interface SettingsDialogProps {
    // todo
}

/**
 * Props required by the <SettingsDialogProps> component.
 */
interface SettingsDialogComponentProps extends SettingsDialogProps {
    /**
     * Callback to invoke when the dialog should be closed.
     */
    onClose: () => void;

    /**
     * Whether the dialog should be presented.
     */
    open: boolean;
}

/**
 * The <SettingsDialog> component.
 */
export function SettingsDialog(props: SettingsDialogComponentProps) {
    return (
        <Dialog open={props.open} onClose={props.onClose} fullWidth>
            <DialogTitle sx={{ pb: 0.5 }}>
                Account settings
            </DialogTitle>
            <DialogContent sx={{ pb: 1 }}>
                todo
            </DialogContent>
            <DialogActions sx={{ pt: 0, mr: 2, mb: 0 }}>
                <Button onClick={props.onClose} variant="text">Close</Button>
            </DialogActions>
        </Dialog>
    );
}
