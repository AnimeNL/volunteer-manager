// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { useState } from 'react';

import { type FieldValues, FormContainer } from '@proxy/react-hook-form-mui';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

import { PasswordField } from './PasswordField';

/**
 * Props accepted by the <LoginPasswordUpdateDialog> component.
 */
interface LoginPasswordUpdateDialogProps {
    /**
     * To be invoked when the form should be closed, e.g. by being cancelled.
     */
    onClose: () => void;

    /**
     * To be invoked when the dialog has been submitted for the given `plaintextPassword`.
     */
    onSubmit: (plaintextPassword: string) => Promise<void>;
}

/**
 * The <LoginPasswordUpdateDialog> component, where the user ends up after they sign in with their
 * access code. They will be prompted to set a new password for their account immediately, which
 * will be stored upon verification.
 */
export function LoginPasswordUpdateDialog(props: LoginPasswordUpdateDialogProps) {
    const { onClose, onSubmit } = props;

    const [ error, setError ] = useState<string | undefined>();
    const [ loading, setLoading ] = useState<boolean>(false);

    async function requestSubmit(data: FieldValues) {
        setError(undefined);
        setLoading(true);

        try {
            await onSubmit(data.password);
        } catch (error) {
            setError((error as any)?.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <FormContainer onSuccess={requestSubmit}>
            <DialogTitle>Update your password</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    You have to choose a new password. Please enter it in the field below in order
                    to update it. You will be signed in immediately after.
                </DialogContentText>
                <Collapse in={!!error}>
                    <DialogContentText sx={{ paddingTop: 1 }} color="error">
                        {error}&nbsp;
                    </DialogContentText>
                </Collapse>
                <Box sx={{ pt: 2 }}>
                    <PasswordField name="password" label="New password" type="password"
                                   fullWidth size="small" required
                                   autoFocus autoComplete="new-password" />
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button loading={loading} type="submit" variant="contained">
                    Sign in
                </Button>
            </DialogActions>
        </FormContainer>
    );
}
