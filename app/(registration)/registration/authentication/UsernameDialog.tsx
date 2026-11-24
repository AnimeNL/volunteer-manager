// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { useState } from 'react';

import { type FieldValues, FormContainer, TextFieldElement } from '@proxy/react-hook-form-mui';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

/**
 * Props accepted by the <UsernameDialog> component.
 */
interface UsernameDialogProps {
    /**
     * To be invoked when the form should be closed, e.g. by being cancelled.
     */
    onClose: () => void;

    /**
     * To be invoked when the username dialog has been submitted for the given `username`.
     */
    onSubmit: (username: string) => Promise<void>;
}

/**
 * Prompts the user for their username, which usually will be their e-mail address. Accepts both
 * submission and cancellation of the flow through the dialog's action buttons.
 */
export function UsernameDialog(props: UsernameDialogProps) {
    const { onClose, onSubmit } = props;

    const [ error, setError ] = useState<string | undefined>();
    const [ loading, setLoading ] = useState<boolean>(false);

    async function requestSubmit(data: FieldValues) {
        setError(undefined);
        setLoading(true);

        try {
            await onSubmit(data.username);
        } catch (error) {
            setError((error as any)?.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <FormContainer onSuccess={requestSubmit}>
            <DialogTitle>Hello there!</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    Please enter your e-mail address to identify yourself with the AnimeCon
                    volunteer portal, even if you're just about to sign up.
                </DialogContentText>
                <Collapse in={!!error}>
                    <DialogContentText sx={{ paddingTop: 1 }} color="error">
                        {error}&nbsp;
                    </DialogContentText>
                </Collapse>
                <Box sx={{ pt: 2 }}>
                    <TextFieldElement name="username" label="E-mail" type="email"
                                      fullWidth size="small" required
                                      autoFocus autoComplete="username" />
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button loading={loading} type="submit" variant="contained">
                    Proceed
                </Button>
            </DialogActions>
        </FormContainer>
    );
}
