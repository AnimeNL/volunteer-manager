// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import { type FieldValues, FormContainer, TextFieldElement } from '@proxy/react-hook-form-mui';

import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

import type { EmailClientSettings } from '@lib/integrations/email/EmailClient';
import { SubmitCollapse } from '../../components/SubmitCollapse';
import { callApi } from '@lib/callApi';

export type EmailSettings = EmailClientSettings;

/**
 * Props accepted by the <EmailProps> component.
 */
interface EmailProps {
    /**
     * The settings for which this integration should be displayed.
     */
    settings: EmailClientSettings;
}

/**
 * The <Email> component displays the available configuration used for sending e-mail to volunteers,
 * which we do over an SMTP connection.
 */
export function Email(props: EmailProps) {
    const { settings } = props;

    const [ error, setError ] = useState<string>();
    const [ invalidated, setInvalidated ] = useState<boolean>(false);
    const [ loading, setLoading ] = useState<boolean>(false);

    const handleInvalidate = useCallback(() => setInvalidated(true), [ /* no deps */ ]);
    const handleSubmit = useCallback(async (data: FieldValues) => {
        setLoading(true);
        setError(undefined);
        try {
            await callApi('post', '/api/admin/update-integration', {
                email: {
                    hostname: data.hostname,
                    port: parseInt(data.port, 10),
                    username: data.username,
                    password: data.password,
                },
            });
            setInvalidated(false);
        } catch (error: any) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    }, [ /* no deps */ ]);

    return (
        <Paper sx={{ p: 2 }}>
            <Typography variant="h5" sx={{ pb: 1 }}>
                E-mail
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
                The SMTP server and authentication details used to send e-mails from the manager.
            </Alert>
            <FormContainer defaultValues={settings} onSuccess={handleSubmit}>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 6 }}>
                        <TextFieldElement name="hostname" label="Hostname" fullWidth
                                          size="small" onChange={handleInvalidate} />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                        <TextFieldElement name="port" label="Port" fullWidth
                                          size="small" onChange={handleInvalidate} />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                        <TextFieldElement name="username" label="Username" fullWidth
                                          size="small" onChange={handleInvalidate} />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                        <TextFieldElement name="password" label="Password" fullWidth size="small"
                                          type="password" onChange={handleInvalidate} />
                    </Grid>
                </Grid>
                <SubmitCollapse error={error} loading={loading} open={invalidated} sx={{ mt: 2 }} />
            </FormContainer>
        </Paper>
    );
}
