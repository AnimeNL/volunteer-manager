// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { useCallback, useState } from 'react';

import { type FieldValues, FormContainer, TextFieldElement } from '@proxy/react-hook-form-mui';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

import { PasswordField } from './PasswordField';

/**
 * Props accepted by the <IdentityPasswordDialog> component.
 */
interface IdentityPasswordDialogProps {
    /**
     * To be invoked when the form should be closed, e.g. by being cancelled.
     */
    onClose: () => void;

    /**
     * To be invoked when the form has been submitted. Both the current and new passwords will be
     * communicated in plaintext, to be hashed prior to being sent to the server.
     */
    onSubmit: (currentPlaintextPassword: string, newPlaintextPassword: string) => Promise<boolean>;
}

/**
 * The <IdentityPasswordDialog> dialog displays a dialog that allows a user to update their
 * password. They must enter their old password, as well as their new password, twice.
 */
export function IdentityPasswordDialog(props: IdentityPasswordDialogProps) {
    const { onClose, onSubmit } = props;

    const [ error, setError ] = useState<string | undefined>(undefined);
    const [ loading, setLoading ] = useState<boolean>(false);
    const [ success, setSuccess ] = useState<boolean>(false);

    const handleSubmit = useCallback(async (data: FieldValues) => {
        setError(undefined);
        setLoading(true);
        setSuccess(false);

        try {
            await onSubmit(data.currentPassword, data.updatedPassword)
                ? setSuccess(true)
                : setError('The server was not able to update your password.');

        } catch (error) {
            setError((error as any)?.message);
        } finally {
            setLoading(false);
        }
    }, [ onSubmit ]);

    return (
        <FormContainer onSuccess={handleSubmit}>
            <DialogTitle>Update your password</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    You'll need to confirm your current password before picking a new one.
                </DialogContentText>
                <Box sx={{ pt: 2 }}>
                    <TextFieldElement name="currentPassword" label="Current Password"
                                      type="password" fullWidth size="small" required autoFocus
                                      autoComplete="current-password" />
                </Box>
                <Box sx={{ pt: 2 }}>
                    <PasswordField name="updatedPassword" label="New password" type="password"
                                   fullWidth size="small" required
                                   autoComplete="new-password" />
                </Box>
                <Collapse in={!!error}>
                    <Alert sx={{ marginTop: 2 }} severity="error">
                        {error}&nbsp;
                    </Alert>
                </Collapse>
                <Collapse in={!!success}>
                    <Alert sx={{ marginTop: 2 }} severity="success">
                        Your password has been updated.
                    </Alert>
                </Collapse>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
                <Button loading={loading} disabled={success} type="submit" variant="contained">
                    Update
                </Button>
            </DialogActions>
        </FormContainer>
    );
}
