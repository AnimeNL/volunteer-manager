// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from 'next/link';
import { useState } from 'react';

import { type FieldValues, CheckboxElement, FormContainer } from '@proxy/react-hook-form-mui';

import { default as MuiLink } from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';

import type { RegisterDefinition } from '@app/api/auth/register';
import { PasswordField } from './PasswordField';
import { RegisterForm } from './RegisterForm';
import { dayjs } from '@lib/DateTime';

/**
 * Interface describing the information contained within a registration request. Will be shared with
 * the server in order to finalize a user's registration.
 */
export type PartialRegistrationRequest =
    Omit<RegisterDefinition['request'], 'username' | 'password' | 'redirect'>;

/**
 * Props accepted by the <RegisterDialog> component.
 */
interface RegisterDialogProps {
    /**
     * To be invoked when the form should be closed, e.g. by being cancelled.
     */
    onClose: () => void;

    /**
     * To be invoked when the registration form is ready to be submitted. The promise will reject
     * when an error occurred (regardless of the type of error), whereas it will be resolved when
     * the registration request went through successfully.
     */
    onSubmit: (plaintextPassword: string, request: PartialRegistrationRequest) => Promise<void>;

    /**
     * The username for whom the form is being displayed. Aid to autofill implementations.
     */
    username: string;
}

/**
 * The <RegisterDialog> dialog allows users to create a new account. They will be prompted for their
 * personal information, after which an account will be created for them.
 */
export function RegisterDialog(props: RegisterDialogProps) {
    const { onClose, onSubmit, username } = props;

    const [ error, setError ] = useState<string | undefined>();
    const [ loading, setLoading ] = useState<boolean>(false);

    async function requestRegistration(data: FieldValues) {
        setError(undefined);
        setLoading(true);

        // Separate the |password| from the |rest| of the data given that we want to hash it on the
        // client side to prevent sending it to the server altogether, the |rawBirthdate| because
        // we want to make sure that it's shared in a particular format, and the |username| because
        // it's only included in the form to help autofill providers in browsers.
        // biome-ignore lint/correctness/noUnusedVariables: not implemented yet
        const { rawBirthdate, username, password, ...rest } = data;

        // Format the |birthdate| in YYYY-MM-DD format because that's the only sensible format to
        // write down a date. Also happens to be how we store it in the database.
        const birthdate = dayjs(rawBirthdate).format('YYYY-MM-DD');

        try {
            await onSubmit(password, { ...rest, birthdate } as PartialRegistrationRequest);
        } catch (error) {
            setError((error as any)?.message);
        } finally {
            setLoading(false);
        }
    }

    // The user has to accept our GDPR and data sharing policies, which are common across the
    // different volunteer manager environments.
    const gdprLabel =
        <Typography>
            Yes, I accept the <MuiLink component={Link} target="_blank" href="/privacy">GDPR and
            data sharing policies</MuiLink>.
        </Typography>;

    return (
        <FormContainer onSuccess={requestRegistration}>
            <input type="hidden" name="username" value={username} />
            <DialogTitle>Create an account</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    Please fill in the following details in order to create an account, which will
                    allow you to apply as a volunteer to one of the AnimeCon festivals.
                </DialogContentText>
                <Collapse in={!!error}>
                    <Alert severity="error" sx={{ my: 1 }}>
                        {error}
                    </Alert>
                </Collapse>
                <Grid container spacing={2} sx={{ pt: 2 }}>
                    <RegisterForm />
                    <Grid size={{ xs: 12 }}>
                        <PasswordField name="password" label="Password" type="password"
                                       fullWidth size="small" required
                                       autoComplete="new-password" />
                    </Grid>
                    <Grid size={{ xs: 12 }} sx={{ pt: 0 }}>
                        <CheckboxElement name="gdpr" size="small" label={gdprLabel} />
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
                <Button loading={loading} type="submit" variant="contained">
                    Register
                </Button>
            </DialogActions>
        </FormContainer>
    );
}
