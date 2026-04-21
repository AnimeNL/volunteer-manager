// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ServerAction } from '@lib/serverAction';
import { Avatar } from '@components/Avatar';
import { ContrastBox } from '@app/admin/components/ContrastBox';
import { Temporal, formatDate } from '@lib/Temporal';

/**
 * Props accepted by the <RejectedApplication> component.
 */
interface RejectedApplicationProps {
    /**
     * Basic information about the volunteer's application that will be shown in this interface.
     */
    application: {
        /**
         * URL to the volunteer's avatar, when known.
         */
        avatar?: string;

        /**
         * Date at which the application was received, in a Temporal-compatible serialisation.
         */
        date?: string;

        /**
         * Name of the volunteer, as they would like to be known by.
         */
        name: string;
    };

    /**
     * Server Action that should be called when the application should be reconsidered.
     */
    reconsiderFn?: ServerAction;
}

/**
 * The <RejectedApplication> component represents an individual rejected application. Basic metadata
 * will be shown about the applicant, but the majority will be hidden. When the Server Action to
 * reconsider the application is available, the relevant button will be shown.
 */
export function RejectedApplication(props: RejectedApplicationProps) {
    const { application, reconsiderFn } = props;

    const router = useRouter();

    const [ errorOpen, setErrorOpen ] = useState<boolean>(false);
    const [ error, setError ] = useState<string | undefined>();

    const [ loading, setLoading ] = useState<boolean>(false);

    const handleReconsider = useCallback(async () => {
        setLoading(true);
        try {
            const result = await reconsiderFn?.(new FormData);
            if (!result || !result.success)
                throw new Error(result?.error || 'Unable to process the reconsideration…');

            router.refresh();

        } catch (error: any) {
            setError(error.message);
            setErrorOpen(true);
        } finally {
            setLoading(false);
        }
    }, [ reconsiderFn, router ]);

    return (
        <Stack component={ContrastBox} direction="row" sx={{
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 2
        }}>
            <Stack direction="row" spacing={2}
                   divider={ <Divider orientation="vertical" flexItem /> } sx={{
                alignItems: 'center',
            }}>
                <Avatar src={application.avatar}>
                    {application.name}
                </Avatar>
                <Box>
                    <Typography variant="subtitle1">
                        {application.name}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'action.active' }}>
                        { formatDate(
                            Temporal.ZonedDateTime.from(application.date!),
                            'dddd, MMMM D, YYYY') }
                    </Typography>
                </Box>
            </Stack>
            { !!props.reconsiderFn &&
                <Button loading={loading} variant="outlined" onClick={handleReconsider}>
                    Reconsider
                </Button> }
            { !!error &&
                <Snackbar open={errorOpen} autoHideDuration={3000}
                          onClose={ () => setErrorOpen(false) }>
                    <Alert severity="error" variant="filled">
                        {error}
                    </Alert>
                </Snackbar> }
        </Stack>
    );
}
