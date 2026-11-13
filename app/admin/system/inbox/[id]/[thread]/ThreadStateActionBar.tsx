// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import Alert, { alertClasses } from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ServerAction } from '@lib/serverAction';
import { LocalDateTime } from '@app/admin/components/LocalDateTime';

/**
 * Props accepted by the <ThreadStateActionBar> component.
 */
export interface ThreadStateActionBarProps {
    /**
     * Bound Server Action to update the thread's resolution state, omitted when the current user
     * only has read access to the inbox.
     */
    action?: ServerAction;

    /**
     * Whether the thread is currently marked as completed.
     */
    resolved: boolean;

    /**
     * Timestamp at which the thread was marked as completed, if applicable.
     */
    resolvedDate?: string;
}

/**
 * Action bar displayed inside the thread header section, showing the current thread state and
 * allowing eligible users to mark the thread as completed or needing action.
 */
export function ThreadStateActionBar(props: ThreadStateActionBarProps) {
    const { action, resolved, resolvedDate } = props;

    const router = useRouter();

    const [ errorMessage, setErrorMessage ] = useState<string | undefined>();
    const [ loading, setLoading ] = useState<boolean>(false);

    const handleCloseError = useCallback(() => {
        setErrorMessage(undefined);
    }, [ /* no deps */ ]);

    const handleToggle = useCallback(async (nextResolved: boolean) => {
        if (!action)
            return;

        setLoading(true);
        setErrorMessage(undefined);

        try {
            const result = await action({ resolved: nextResolved });
            if (result.success)
                router.refresh();
            else
                setErrorMessage(result.error ?? 'Unable to update the thread status.');
        } catch (error: any) {
            setErrorMessage(error?.message || 'Unable to update the thread status.');
        } finally {
            setLoading(false);
        }
    }, [ action, router ]);

    return (
        <>
            <Alert severity={ resolved ? 'success' : 'warning' }
                   sx={{
                       [`& .${alertClasses.message}`]: {
                           flexGrow: 1,
                           py: 0.5,
                       },
                       transition: 'background-color ease-in .3s',
                   }}>
                <Stack direction="row" spacing={2}
                       sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="inherit">
                        { !resolved && 'This thread is pending a response and needs action.' }
                        { !!resolved && !resolvedDate &&
                            'This thread has been marked as completed.' }
                        { !!resolved && !!resolvedDate &&
                            <>
                                This thread was marked as completed on{' '}
                                <LocalDateTime dateTime={resolvedDate} format="YYYY-MM-DD HH:mm" />.
                            </> }
                    </Typography>
                    { !!action && !resolved &&
                        <Button color="inherit" loading={loading}
                                onClick={() => handleToggle(true)} size="small"
                                sx={{ flexShrink: 0 }}>
                            Mark as completed
                        </Button> }
                    { !!action && !!resolved &&
                        <Button color="inherit" loading={loading}
                                onClick={() => handleToggle(false)} size="small"
                                sx={{ flexShrink: 0 }}>
                            Mark as needing action
                        </Button> }
                </Stack>
            </Alert>
            <Snackbar autoHideDuration={5000} open={!!errorMessage} onClose={handleCloseError}>
                <Alert onClose={handleCloseError} severity="error" variant="filled">
                    {errorMessage}
                </Alert>
            </Snackbar>
        </>
    );
}
