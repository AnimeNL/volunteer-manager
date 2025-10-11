// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';
import Button from '@mui/material/Button';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

/**
 * Props accepted by the <ActivationReminderDialog> component.
 */
interface ActivationReminderDialogProps {
    /**
     * To be invoked when the form should be closed, e.g. by being cancelled.
     */
    onClose: () => void;
}

/**
 * The <ActivationReminderDialog> dialog reminds a user that they have yet to activate their account
 * by checking their e-mail, and clicking on the link therein.
 */
export function ActivationReminderDialog(props: ActivationReminderDialogProps) {
    const { onClose } = props;

    return (
        <>
            <DialogTitle>Activate your account</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    Your account was created but has not been activated yet, please check your
                    e-mail. Alternatively,&nbsp;
                    <MuiLink component={Link} href="mailto:crew@animecon.nl">
                        send us a message
                    </MuiLink>
                    &nbsp;in case you have not received it.
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} variant="contained">Close</Button>
            </DialogActions>
        </>
    );
}
