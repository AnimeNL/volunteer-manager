// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import { type FieldValues, FormContainer, TextFieldElement } from '@proxy/react-hook-form-mui';

import { default as MuiLink } from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

import type { AnimeConClientSettings } from '@lib/integrations/animecon/AnimeConClient';
import { SubmitCollapse } from '../../components/SubmitCollapse';
import { callApi } from '@lib/callApi';

/**
 * Settings applicable to the <AnimeCon> component that can be edited through this component. We
 * simply map this as an alias to the AnimeCon Client settings.
 */
export type AnimeConSettings = AnimeConClientSettings;

/**
 * Props accepted by the <AnimeCon> component.
 */
interface GoogleProps {
    /**
     * The settings for which this integration should be displayed.
     */
    settings: AnimeConSettings;
}

/**
 * The <AnimeCon> component allows the settings for our integration with the AnimeCon API to be
 * configured. We use a service account to gain access to the information contained therein.
 */
export function AnimeCon(props: GoogleProps) {
    const { settings } = props;

    const router = useRouter();

    const [ error, setError ] = useState<string>();
    const [ invalidated, setInvalidated ] = useState<boolean>(false);
    const [ loading, setLoading ] = useState<boolean>(false);

    const requestQueryApi = useCallback(() => {
        router.push('./integrations/animecon');
    }, [ router ]);

    const doInvalidate = useCallback(() => setInvalidated(true), [ /* no deps */ ]);
    const requestSubmit = useCallback(async (data: FieldValues) => {
        setLoading(true);
        setError(undefined);
        try {
            await callApi('post', '/api/admin/update-integration', {
                animecon: { ...data as any },
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
                AnimeCon
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }} action={
                <Button color="inherit" size="small" onClick={requestQueryApi}>
                    Query API
                </Button>
            }>
                Event and program information is obtained through the AnimeCon API (
                <MuiLink component={Link} href="https://github.com/AnimeNL/rest-api">source</MuiLink>),
                for which we identify using a service account.
            </Alert>
            <FormContainer defaultValues={settings} onSuccess={requestSubmit}>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 6 }}>
                        <TextFieldElement name="apiEndpoint" label="API endpoint" fullWidth
                                          size="small" onChange={doInvalidate} />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                        <TextFieldElement name="authEndpoint" label="Authentication endpoint"
                                          fullWidth size="small" onChange={doInvalidate} />
                    </Grid>

                    <Grid size={{ xs: 6 }}>
                        <TextFieldElement name="clientId" label="Client ID" fullWidth
                                          size="small" onChange={doInvalidate} />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                        <TextFieldElement name="clientSecret" label="Client Secret" fullWidth
                                          size="small" onChange={doInvalidate} />
                    </Grid>

                    <Grid size={{ xs: 6 }}>
                        <TextFieldElement name="username" label="Username" fullWidth
                                          size="small" onChange={doInvalidate} />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                        <TextFieldElement name="password" label="Password" type="password" fullWidth
                                          size="small" onChange={doInvalidate} />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <TextFieldElement name="scopes" label="Scopes" fullWidth
                                          size="small" onChange={doInvalidate} />
                    </Grid>
                </Grid>
                <SubmitCollapse error={error} loading={loading} open={invalidated} sx={{ mt: 2 }} />
            </FormContainer>
        </Paper>
    );
}
