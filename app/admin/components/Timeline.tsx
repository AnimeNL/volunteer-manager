// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTheme } from '@mui/material/styles';

import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';

import { Temporal } from '@lib/Temporal';
import { Timeline as TimelineInternal } from '@AnimeNL/volunteer-manager-timeline';

import type { TimelineEvent, TimelineEventMutation, TimelineProps as TimelineInternalProps }
    from '@AnimeNL/volunteer-manager-timeline';

import '@AnimeNL/volunteer-manager-timeline/dist/volunteer-manager-timeline.css';

/**
 * Re-export the types exposed by the internal implementation.
 */
export type { TimelineEvent, TimelineEventMutation };

/**
 * Props accepted by the <Timeline> event.
 */
export type TimelineProps =
    Omit<TimelineInternalProps, 'dataTimezone' | 'onError' | 'temporal' | 'theme'> & {
        /**
         * Subject to identify what this timeline is dealing with. Defaults to "event".
         */
        subject?: string;
    };

/**
 * The <Timeline> component is a generic timeline that supports both mutable and immutable entries,
 * each of which enjoys individual timing. It's a generic component without any specific purpose,
 * whose styling will adjust based on configuration.
 */
export function Timeline(props: TimelineProps) {
    const subject = props.subject ?? 'event';
    const theme = useTheme();

    const [ errorOpen, setErrorOpen ] = useState<boolean>(false);
    const [ errorMessage, setErrorMessage ] = useState<string | undefined>();
    const [ mounted, setMounted ] = useState<boolean>(false);

    useEffect(() => setMounted(true), [ /* no dependencies */ ]);

    const handleErrorClose = useCallback(() => setErrorOpen(false), [ /* no dependencies */ ]);
    const handleError = useCallback((action: 'create' | 'update', reason: 'invalid' | 'overlap') =>
    {
        switch (reason) {
            case 'invalid':
                setErrorMessage(`Cannot schedule the ${subject} at that time`);
                break;

            case 'overlap':
                setErrorMessage(`Cannot overlap with another ${subject}`);
                break;

            default:
                setErrorMessage('Something went wrong');
                break;
        }

        setErrorOpen(true);

    }, [ subject ]);

    // Only render timelines on the client, never on the server. This is meaningful because the
    // calendar component calculates text colour, which yields different results.
    if (!mounted)
        return null;

    return (
        <>
            <TimelineInternal {...props} dataTimezone="utc" temporal={Temporal}
                              theme={theme.palette.mode} onError={handleError} />
            <Snackbar autoHideDuration={3000} onClose={handleErrorClose} open={errorOpen}>
                <Alert severity="error" variant="filled" sx={{ width: '100%' }}>
                    {errorMessage}
                </Alert>
            </Snackbar>
        </>
    );
}
