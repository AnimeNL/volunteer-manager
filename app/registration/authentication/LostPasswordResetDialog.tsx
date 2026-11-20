// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { useEffect, useState } from 'react';

import { type FieldValues, FormContainer } from '@proxy/react-hook-form-mui';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Skeleton from '@mui/material/Skeleton';

import { PasswordField } from './PasswordField';

import { verifyPasswordResetAction } from '@lib/auth/AccountAuthActions';

/**
 * Props accepted by the <LostPasswordResetDialog> component.
 */
interface LostPasswordResetDialogProps {
    /**
     * To be invoked when the form should be closed, e.g. by being cancelled.
     */
    onClose: () => void;

    /**
     * To be invoked when the password reset request was valid, and the user would like their
     * old password to be replaced by |password|.
     */
    onPasswordReset: (request: string, password: string) => Promise<void>;

    /**
     * The password reset request for which the authentication flow should continue.
     */
    passwordResetRequest: string;
}

/**
 * The <LostPasswordResetDialog> dialog receives the password reset token, verifies this with the
 * server and then allows the user to reset their password with a new one of their liking.
 */
export function LostPasswordResetDialog(props: LostPasswordResetDialogProps) {
    const { onClose, onPasswordReset, passwordResetRequest } = props;

    const [ firstName, setFirstName ] = useState<string | undefined>(undefined);
    const [ requestValid, setRequestValid ] = useState<boolean | undefined>(undefined);

    // Verify the password reset request through the authentication endpoint, which will also tell
    // us about the user's first name to display in the dialog.
    useEffect(() => {
        verifyPasswordResetAction({
            request: passwordResetRequest,
        }).then(response => {
            setTimeout(() => {
                setFirstName(response.firstName);
                setRequestValid(response.success);
            }, 500);
        });
    }, [ passwordResetRequest ]);

    // State associated with a successful verification, which allows the user to actually update
    // their password. The same sealed password request will be send back to the server again.
    const [ error, setError ] = useState<string | undefined>();
    const [ loading, setLoading ] = useState<boolean>(false);

    async function requestResetPassword(data: FieldValues) {
        setError(undefined);
        setLoading(true);

        try {
            await onPasswordReset(passwordResetRequest, data.password);
        } catch (error) {
            setError((error as any)?.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <DialogTitle>Password reset</DialogTitle>
            { requestValid === undefined &&
                <DialogContent>
                    <Skeleton animation="wave" height={16} sx={{ mb: 1 }} />
                    <Skeleton animation="wave" height={16} width="80%" />
                </DialogContent> }
            { requestValid === true &&
                <FormContainer onSuccess={requestResetPassword}>
                    <DialogContent sx={{ pt: 0 }}>
                        <DialogContentText>
                            Thank you for checking your e-mail, <strong>{firstName}</strong>. Please
                            enter your new password in the field below in order to update it.
                        </DialogContentText>
                        <Collapse in={!!error}>
                            <DialogContentText sx={{ paddingTop: 1 }} color="error">
                                {error}
                            </DialogContentText>
                        </Collapse>
                        <Box sx={{ pt: 2 }}>
                            <PasswordField name="password" label="New password" type="password"
                                           fullWidth size="small" required
                                           autoFocus autoComplete="new-password" />
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={onClose}>Close</Button>
                        <Button loading={loading} type="submit" variant="contained">
                            Update
                        </Button>
                    </DialogActions>
                </FormContainer> }
            { requestValid === false &&
                <>
                    <DialogContent>
                        <DialogContentText>
                            This password reset link no longer is valid. Please try signing in to
                            your account again and request a new link if you still need one.
                        </DialogContentText>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={onClose} variant="contained">Close</Button>
                    </DialogActions>
                </> }
        </>
    );
}
