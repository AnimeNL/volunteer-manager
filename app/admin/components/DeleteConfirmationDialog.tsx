// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';

/**
 * Props accepted by the <DeleteConfirmationDialog> component.
 */
export interface DeleteConfirmationDialogProps {
    /**
     * Whether the dialog should be open.
     */
    open: boolean;

    /**
     * Callback when the dialog has been closed.
     */
    onClose: () => void;

    /**
     * Callback when the delete action has been confirmed.
     */
    onDelete: () => Promise<void> | void;

    /**
     * Subject describing what is being deleted.
     * @default "item"
     */
    subject?: string;

    /**
     * Whether the delete action is currently loading.
     */
    loading?: boolean;
}

/**
 * The <DeleteConfirmationDialog> component encapsulates the confirmation dialog when deleting items in the admin panels.
 */
export function DeleteConfirmationDialog(props: DeleteConfirmationDialogProps) {
    const { open, onClose, onDelete, loading } = props;
    const subject = props.subject ?? 'item';

    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>
                Delete this {subject}?
            </DialogTitle>
            <DialogContent>
                Are you sure that you want to remove this {subject}? This action can't be
                undone once you confirm its deletion.
            </DialogContent>
            <DialogActions sx={{ p: 2, pt: 0 }}>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={onDelete} loading={loading} variant="contained">
                    Delete
                </Button>
            </DialogActions>
        </Dialog>
    );
}
