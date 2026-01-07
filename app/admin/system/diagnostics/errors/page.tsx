// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import { ErrorLogsDataTable } from './ErrorLogsDataTable';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

/**
 * The error logs page displays an overview of the issues that have occurred on the volunteer
 * manager, i.e. both client-side and server-side JavaScript errors. They're tracked for system
 * resiliency purposes.
 */
export default async function ErrorLogsPage() {
    await requireAuthenticationContext({
        check: 'admin',
        permission: {
            permission: 'system.logs',
            operation: 'read',
        },
    });

    return <ErrorLogsDataTable includeLocalColumn={!!process.env.APP_ENVIRONMENT_OVERRIDE} />;
}

export const metadata: Metadata = {
    title: 'Error logs | AnimeCon Volunteer Manager',
};
