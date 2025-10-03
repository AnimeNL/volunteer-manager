// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { type FieldValues, FormContainer } from '@proxy/react-hook-form-mui';

import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

import { EventSettingsForm } from './[event]/settings/EventSettingsForm';
import { SubmitCollapse } from '../components/SubmitCollapse';
import { dayjs } from '@lib/DateTime';
import { callApi } from '@lib/callApi';

/**
 * The <EventCreate> component enables certain volunteers to create new events on the fly. While
 * this happens roughly once per year, this panel doesn't take too much time to support.
 */
export function EventCreate() {
    const [ error, setError ] = useState<string>();
    const [ invalidated, setInvalidated ] = useState<boolean>(false);
    const [ loading, setLoading ] = useState<boolean>(false);

    const router = useRouter();

    const handleChange = useCallback(() => setInvalidated(true), [ /* no deps */ ]);
    const handleSubmit = useCallback(async (data: FieldValues) => {
        setError(undefined);
        setLoading(true);
        try {
            const response = await callApi('post', '/api/admin/create-event', {
                name: data.name,
                shortName: data.shortName,
                slug: data.slug,
                startTime: dayjs(data.startTime).utc().toISOString(),
                endTime: dayjs(data.endTime).utc().toISOString(),
            });

            setError(response.error);
            if (response.slug)
                router.push(`/admin/events/${response.slug}/settings`);
        } catch (error: any) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    }, [ router ]);

    const defaultValues = useMemo(() => ({
        startTime: dayjs().set('hour', 14).set('minute', 0).set('second', 0),
        endTime: dayjs().set('hour', 20).set('minute', 0).set('second', 0).add(3, 'day'),
    }), [ /* no deps */ ]);

    return (
        <Paper sx={{ p: 2 }}>
            <Typography variant="h5" sx={{ pb: 1 }}>
                Create new event
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
                Events will be created immediately, but will remain hidden until they manually get
                published by an administrator.
            </Alert>
            <FormContainer defaultValues={defaultValues} onSuccess={handleSubmit}>
                <Grid container spacing={2}>
                    <EventSettingsForm mutableSlug onChange={handleChange} />
                </Grid>
                <SubmitCollapse error={error} loading={loading} open={invalidated} sx={{ mt: 2 }} />
            </FormContainer>
        </Paper>
    );
}
