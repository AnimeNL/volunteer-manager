// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

import { callApi } from '@lib/callApi';

/**
 * Declare existence of the `avpReportedErrors` global, through which we track when the last
 * error was reported to the server to avoid hammering it with errors.
 */
declare global {
    interface Window {
        avpClientReportedErrors: string[];
    }
}

/**
 * Props accepted by the <ErrorPageClientReporter> component.
 */
interface ErrorPageClientReporterProps {
    /**
     * The HTTP status code matching the error that was thrown.
     */
    statusCode: number;
}

/**
 * Client-side component that reports seen error pages back to the server. This is necessary because
 * Next.js can't always give us access to the requested path on the server. Errors for a given
 * pathname will be reported at most once per user per browsing sessions.
 */
export function ErrorPageClientReporter(props: ErrorPageClientReporterProps) {
    const pathname = usePathname();

    useEffect(() => {
        if (typeof window === 'undefined')
            return;  // only allow the effect handler to run in client code

        if (!Array.isArray(window.avpClientReportedErrors))
            window.avpClientReportedErrors = [];

        if (window.avpClientReportedErrors.includes(pathname))
            return;

        window.avpClientReportedErrors.push(pathname);

        callApi('post', '/api/error', {
            pathname,
            statusCode: props.statusCode,
        });

    }, [ pathname, props.statusCode ]);

    return null;
}
