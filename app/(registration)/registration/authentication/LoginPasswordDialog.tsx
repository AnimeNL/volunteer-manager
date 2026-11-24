// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';
import { useState } from 'react';

import { type FieldValues, FormContainer, TextFieldElement } from '@proxy/react-hook-form-mui';

import { default as MuiLink } from '@mui/material/Link';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

/**
 * Props accepted by the <LoginPasswordDialog> component.
 */
interface LoginPasswordDialogProps {
    /**
     * To be invoked when the form should be closed, e.g. by being cancelled.
     */
    onClose: () => void;

    /**
     * To be invoked when the user has lost their password and wants to request a new one.
     */
    onLostPassword: () => void;

    /**
     * To be invoked when the dialog has been submitted for the given `plaintextPassword`.
     */
    onSubmit: (plaintextPassword: string) => Promise<void>;
}

/**
 * The <LoginPasswordDialog> component allows users to sign in to their account. They will be asked
 * to enter their password, which, when verified by the server, will sign them in to their account.
 */
export function LoginPasswordDialog(props: LoginPasswordDialogProps) {
    const { onClose, onLostPassword, onSubmit } = props;

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
            <DialogTitle>Sign in</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    Please enter your password to sign in to your account, or&nbsp;
                    <MuiLink component={Link} href="#" onClick={onLostPassword}>reset
                    your password</MuiLink> in case you have lost your password.
                </DialogContentText>
                <Collapse in={!!error}>
                    <DialogContentText sx={{ paddingTop: 1 }} color="error">
                        {error}&nbsp;
                    </DialogContentText>
                </Collapse>
                <Box sx={{ pt: 2 }}>
                    <TextFieldElement name="password" label="Password" type="password"
                                      fullWidth size="small" required
                                      autoFocus autoComplete="current-password" />
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
