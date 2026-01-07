// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import { LogsDataTable } from './LogsDataTable';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

/**
 * The logs page provides access to the most recent log entries created by the Volunteer Manager,
 * with a variety of filtering options available. All log entries are made accessible to the client,
 * however they will be streamed by the server to deal with ~infinitely large data sets.
 */
export default async function SystemLogsPage() {
    const { access } = await requireAuthenticationContext({
        check: 'admin',
        permission: {
            permission: 'system.logs',
            operation: 'read',
        },
    });

    return <LogsDataTable enableDelete={ access.can('system.logs', 'delete') } />;
}

export const metadata: Metadata = {
    title: 'System logs | AnimeCon Volunteer Manager',
};
