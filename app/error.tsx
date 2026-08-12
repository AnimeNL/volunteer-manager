// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

import { ExportLayout } from '@app/(tools)/exports/[slug]/ExportLayout';
import { callApi } from '@lib/callApi';

/**
 * What is the minimum interval between reported errors? Errors that are thrown within this window
 * will be discarded, other than being shown in the browser console.
 */
const kErrorReportingThresholdMs = 5000;

/**
 * What is the maximum number of errors that should be reported during a single browsing session?
 */
const kErrorReportingLimit = 5;

/**
 * Declare existence of the `avpLastReportedError` global, through which we track when the last
 * error was reported to the server to avoid hammering it with errors.
 */
declare global {
    interface Window {
        avpLastReportedError: number | null;
        avpReportedErrors: number;
    }
}

/**
 * Page that should be shown, on top of the <RootLayout>, when an error has been seen that stops the
 * client from accessing regular functionality. This component, injected as a React error boundary,
 * will also attempt to communicate the error to the server.
 */
export default function ErrorPage({ error }: { error: Error & { digest?: string } }) {
    const digest = error.digest;
    const pathname = usePathname();

    useEffect(() => {
        if (typeof window === 'undefined')
            return;  // only allow the effect handler to run in client code

        console.error(error);

        if (typeof window.avpReportedErrors !== 'number') {
            window.avpLastReportedError = null;
            window.avpReportedErrors = 0;
        }

        const currentTime = performance.now();
        const minimumTime = currentTime - kErrorReportingThresholdMs;

        if (!!window.avpLastReportedError && window.avpLastReportedError > minimumTime)
            return;

        window.avpLastReportedError = currentTime;

        if (++window.avpReportedErrors > kErrorReportingLimit)
            return;

        callApi('post', '/api/error', {
            pathname,
            name: error.name,
            message: error.message,
            stack: error.stack,
            digest: error.digest,
        });

    }, [ error, pathname ]);

    return (
        <ExportLayout eventName="AnimeCon Volunteering Teams">
            <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h5">
                    Whoops! Something went wrong…
                </Typography>
                <Typography variant="body1" sx={{ textWrap: 'balance', py: 1 }}>
                    Something went very wrong and the page you requested is currently not available.
                    Don't worry, it's not you, it's us. Please let us know that this happened,
                    and we'll be happy to help out.
                    { !!digest && ' When you do, please share the following code with us:' }
                </Typography>
                { !!digest && <Chip label={digest} color="error" /> }
            </Paper>
        </ExportLayout>
    );
}
