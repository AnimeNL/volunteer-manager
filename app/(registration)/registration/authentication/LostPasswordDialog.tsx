// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { useCallback, useState } from 'react';

import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

/**
 * Props accepted by the <LostPasswordDialog> component.
 */
interface LostPasswordDialogProps {
    /**
     * To be invoked when the form should be closed, e.g. by being cancelled.
     */
    onClose: () => void;

    /**
     * To be invoked when the user has requested a new password to be send their way.
     */
    onRequestPasswordReset: () => Promise<boolean>;
}

/**
 * The <LostPasswordDialog> dialog allows users to request for their password to be reset in case
 * they lost it. We try to avoid being judgemental, but really...!
 */
export function LostPasswordDialog(props: LostPasswordDialogProps) {
    const { onClose, onRequestPasswordReset } = props;

    const [ loading, setLoading ] = useState<boolean>(false);
    const [ success, setSuccess ] = useState<boolean | undefined>(undefined);

    const requestPasswordReset = useCallback(async () => {
        setLoading(true);

        // In case the user already requested for their password to be reset, pretend like we're
        // requesting it again but otherwise just ignore the request. They can reload.
        if (success !== undefined) {
            setTimeout(() => setLoading(false), 1500);
            return;
        }

        let successfulRequest = false;
        try {
            successfulRequest = await onRequestPasswordReset();
        } finally {
            setSuccess(successfulRequest);
            setLoading(false);
        }

    }, [ onRequestPasswordReset, success ]);

    return (
        <>
            <DialogTitle>Password reset</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    You have lost your password! Don't worry, we can send you an e-mail with
                    instructions on how to reset it. Click on <strong>request</strong> to do this.
                </DialogContentText>
                <Collapse in={success !== undefined}>
                    <DialogContentText sx={{ paddingTop: 1 }} color="error">
                        { success && 'You have received an e-mail with further instructions.' }
                        { !success && 'We couldn\'t send you an e-mail, now\'s the time to panic.' }
                    </DialogContentText>
                </Collapse>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
                <Button loading={loading} onClick={requestPasswordReset} variant="contained">
                    Request
                </Button>
            </DialogActions>
        </>
    );
}
