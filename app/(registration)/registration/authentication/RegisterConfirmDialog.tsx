// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Button from '@mui/material/Button';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

/**
 * Props accepted by the <RegisterConfirmDialog> component.
 */
interface RegisterConfirmDialogProps {
    /**
     * To be invoked when the form should be closed, e.g. by being cancelled.
     */
    onClose: () => void;

    /**
     * The user's first name, to personalize the confirmation with their name.
     */
    firstName: string;
}

/**
 * The <RegisterConfirmDialog> dialog confirms that a new user's registration has been submitted and
 * that they have to check their e-mail for a confirmation message. This dialog has no further
 * interactivity.
 */
export function RegisterConfirmDialog(props: RegisterConfirmDialogProps) {
    const { onClose, firstName } = props;

    return (
        <>
            <DialogTitle>Create an account</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    Thank you for creating an account, <strong>{firstName}</strong>! Please check
                    your e-mail for a confirmation message, after which you're all set.
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} variant="contained">Close</Button>
            </DialogActions>
        </>
    );
}
