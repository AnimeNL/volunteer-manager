// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { useCallback } from 'react';
import { usePathname } from 'next/navigation';

import Button from '@mui/material/Button';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Container from '@mui/material/Container';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';

/**
 * The <LostPasswordCompleteDialog> dialog confirms to a user that their new password has been saved
 * and that they are now signed in to their account.
 */
export function LostPasswordCompleteDialog() {
    const pathname = usePathname();

    const onClose = useCallback(() => {
        if (typeof document !== 'undefined')
            document.location.href = document.location.origin + pathname;

    }, [ pathname ]);

    return (
        <>
            <DialogContent>
                <Container sx={{ textAlign: 'center' }}>
                    <CheckCircleIcon color="success" sx={{ fontSize: '64px' }} />
                    <DialogContentText sx={{ mt: 1 }}>
                        Your password has been updated, and you have been signed in to your account.
                        Click on <strong>close</strong> to continue—the page will be refreshed.
                    </DialogContentText>
                </Container>
            </DialogContent>
            <DialogActions sx={{ justifyContent: 'center', px: '0 !important' }}>
                <Button onClick={onClose} variant="contained">Close</Button>
            </DialogActions>
        </>
    );
}
