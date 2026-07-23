// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTheme } from '@mui/material/styles';

import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';


import '@AnimeNL/volunteer-manager-timeline/dist/volunteer-manager-timeline.css';
import { Schedule as ScheduleInternal } from '@AnimeNL/volunteer-manager-timeline';
import type { ChangeEventContext, ScheduleProps as ScheduleInternalProps, ScheduleEvent,
    ScheduleEventMutation, ScheduleMarker, ScheduleResource }
    from '@AnimeNL/volunteer-manager-timeline';

export type {
    ChangeEventContext, ScheduleEvent, ScheduleEventMutation, ScheduleMarker, ScheduleResource };

/**
 * Props accepted by the <Schedule> event.
 */
export type ScheduleProps =
    Omit<ScheduleInternalProps, 'dataTimezone' | 'onError' | 'temporal' | 'theme'> & {
        /**
         * Subject to identify what this timeline is dealing with. Defaults to "event".
         */
        subject?: string;
    };

/**
 * The <Schedule> component displays a calendar timeline optimised for our scheduling purposes,
 * i.e. grouped resources vertically, and a time series horizontally. The component is optimised for
 * conveying large amounts of data, and real-time interaction between multiple people.
 */
export function Schedule(props: ScheduleProps) {
    const subject = props.subject ?? 'event';
    const theme = useTheme();

    const [ snackbarMessage, setSnackbarMessage ] = useState<string>('Unknown error');
    const [ snackbarSeverity, setSnackbarSeverity ] = useState<'error' | 'info'>('info');
    const [ snackbarOpen, setSnackbarOpen ] = useState<boolean>(false);

    const [ mounted, setMounted ] = useState<boolean>(false);

    useEffect(() => setMounted(true), [ /* no dependencies */ ]);

    // ---------------------------------------------------------------------------------------------

    const handleErrorClose = useCallback(() => setSnackbarOpen(false), [ /* no dependencies */ ]);
    const handleError = useCallback((action: 'create' | 'update', reason: 'invalid' | 'overlap') =>
    {
        setSnackbarSeverity('error');

        switch (reason) {
            case 'invalid':
                setSnackbarMessage(`Cannot schedule the ${subject} at that time`);
                break;

            case 'overlap':
                setSnackbarMessage(`Cannot overlap with another ${subject}`);
                break;

            default:
                setSnackbarMessage('Something went wrong');
                break;
        }

        setSnackbarOpen(true);

    }, [ subject ]);

    // ---------------------------------------------------------------------------------------------

    const didCopy = useCallback((event: ScheduleEvent) => {
        setSnackbarSeverity('info');
        setSnackbarMessage(`Copied the ${event.title} shift to your clipboard`);
        setSnackbarOpen(true);

    }, [ /* no dependencies */ ]);

    const didPaste = useCallback((event: ScheduleEvent, resource: ScheduleResource) => {
        setSnackbarSeverity('info');
        setSnackbarMessage(`Pasted the ${event.title} shift to ${resource.name}`);
        setSnackbarOpen(true);

    }, [ /* no dependencies */ ]);

    const didPasteFail = useCallback((event: ScheduleEvent) => {
        setSnackbarSeverity('error');
        setSnackbarMessage(`Unable to paste the ${event.title} shift`);
        setSnackbarOpen(true);

    }, [ /* no dependencies */ ]);

    // ---------------------------------------------------------------------------------------------

    // Only render timelines on the client, never on the server. This is meaningful because the
    // calendar component calculates text colour, which yields different results.
    if (!mounted)
        return null;

    return (
        <>
            <ScheduleInternal {...props} dataTimezone="utc" temporal={Temporal}
                              theme={theme.palette.mode} onError={handleError}
                              onCopy={didCopy} onPaste={didPaste} onPasteFail={didPasteFail} />
            <Snackbar autoHideDuration={3000} onClose={handleErrorClose} open={snackbarOpen}>
                <Alert severity={snackbarSeverity} variant="filled" sx={{ width: '100%' }}>
                    {snackbarMessage}
                </Alert>
            </Snackbar>
        </>
    );
}
