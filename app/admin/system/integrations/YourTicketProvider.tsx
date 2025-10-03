// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';

import { type FieldValues, FormContainer, TextFieldElement } from '@proxy/react-hook-form-mui';

import { default as MuiLink } from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

import type { YourTicketProviderClientSettings } from '@lib/integrations/yourticketprovider/YourTicketProviderClient';
import { SubmitCollapse } from '../../components/SubmitCollapse';
import { callApi } from '@lib/callApi';

/**
 * Props accepted by the <YourTicketProvider> component.
 */
interface YourTicketProviderProps {
    /**
     * The settings for which this integration should be displayed.
     */
    settings: YourTicketProviderClientSettings;
}

/**
 * The <Email> component displays the available configuration used for sending e-mail to volunteers,
 * which we do over an SMTP connection.
 */
export function YourTicketProvider(props: YourTicketProviderProps) {
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
                yourTicketProvider: {
                    apiKey: data.apiKey,
                    endpoint: data.endpoint,
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
                YourTicketProvider
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
                API integration with the{' '}
                <MuiLink component={Link} href="https://www.yourticketprovider.nl/">
                    YourTicketProvider API
                </MuiLink>, which AnimeCon uses for ticketing purposes.
            </Alert>
            <FormContainer defaultValues={settings} onSuccess={handleSubmit}>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12 }}>
                        <TextFieldElement name="apiKey" label="API Key" fullWidth
                                          size="small" onChange={handleInvalidate} />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <TextFieldElement name="endpoint" label="Endpoint" fullWidth
                                          size="small" onChange={handleInvalidate} />
                    </Grid>
                </Grid>
                <SubmitCollapse error={error} loading={loading} open={invalidated} sx={{ mt: 2 }} />
            </FormContainer>
        </Paper>
    );
}
