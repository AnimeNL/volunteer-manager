// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { type FieldValues, FormContainer, useForm } from '@proxy/react-hook-form-mui';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';

import { RegisterForm } from './RegisterForm';
import { callApi } from '@lib/callApi';
import { dayjs } from '@lib/DateTime';

/**
 * Props accepted by the <IdentityAccountDialog> component.
 */
interface IdentityAccountDialogProps {
    /**
     * To be invoked when the form should be closed, e.g. by being cancelled.
     */
    onClose: () => void;
}

/**
 * The <IdentityAccountDialog> dialog displays the user's account information and allows them to
 * change and update it. Despite the form complexity, this is fairly straightforward.
 */
export function IdentityAccountDialog(props: IdentityAccountDialogProps) {
    const { onClose } = props;

    const form = useForm();
    const router = useRouter();

    const [ error, setError ] = useState<string | undefined>(undefined);
    const [ loading, setLoading ] = useState<boolean>(false);
    const [ success, setSuccess ] = useState<boolean>(false);

    const handleSubmit = useCallback(async (data: FieldValues) => {
        setLoading(true);
        setError(undefined);
        setSuccess(true);
        try {
            const response = await callApi('post', '/api/auth/update-account', {
                update: {
                    firstName: data.firstName,
                    lastName: data.lastName,
                    gender: data.gender,
                    birthdate: dayjs(data.rawBirthdate).format('YYYY-MM-DD'),
                    phoneNumber: data.phoneNumber,
                    discordHandle: data.discordHandle,
                },
            });

            if (!response.success)
                throw new Error(response.error ?? 'Unable to update your account.');

            router.refresh();
            setSuccess(true);

        } catch (error: any) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    }, [ router ]);

    const [ loaded, setLoaded ] = useState<boolean>(false);

    useEffect(() => {
        callApi('post', '/api/auth/update-account', { /* no params */ }).then(response => {
            if (!response || !response.account)
                throw new Error;

            setLoaded(true);
            for (const [ field, value ] of Object.entries(response.account)) {
                if (field === 'birthdate' && !!value)
                    form.setValue('rawBirthdate', dayjs(value));
                else
                    form.setValue(field, value);
            }
        }).catch(error => {
            console.warn(error);
            setError('Unable to load your account information.');
        });
    }, [ form ])

    return (
        <FormContainer formContext={form} onSuccess={handleSubmit}>
            <DialogTitle sx={{ pb: 1 }}>Update your account</DialogTitle>
            <DialogContent sx={{ paddingTop: '8px !important' }}>
                <Collapse in={!loaded}>
                    <Skeleton animation="wave" width="93%" height={10} />
                    <Skeleton animation="wave" width="81%" height={10} />
                    <Skeleton animation="wave" width="88%" height={10} />
                </Collapse>
                <Collapse in={!!loaded}>
                    <Grid container spacing={2}>
                        <RegisterForm />
                    </Grid>
                </Collapse>
                <Collapse in={!!error}>
                    <Alert sx={{ marginTop: 2 }} severity="error">
                        {error}&nbsp;
                    </Alert>
                </Collapse>
                <Collapse in={!!success}>
                    <Alert sx={{ marginTop: 2 }} severity="success">
                        Your account has been updated.
                    </Alert>
                </Collapse>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
                <Button loading={loading} disabled={!loaded || success} type="submit"
                        variant="contained">
                    Update
                </Button>
            </DialogActions>
        </FormContainer>
    );
}
