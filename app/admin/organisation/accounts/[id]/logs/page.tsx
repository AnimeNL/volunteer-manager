// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import type { NextPageParams } from '@lib/NextRouterParams';
import { LogsDataTable } from '@app/admin/system/logs/LogsDataTable';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

/**
 * The <AccountLogsPage> component displays log events that were recorded by the holder of this
 * account, both through their own actions and through actions that affected them.
 */
export default async function AccountLogsPage(props: NextPageParams<'id'>) {
    const { access } = await requireAuthenticationContext({
        check: 'admin',
        permission: {
            permission: 'system.logs',
            operation: 'read',
        },
    });

    const userId = parseInt((await props.params).id, /* radix= */ 10);
    if (!Number.isSafeInteger(userId))
        notFound();

    return (
        <LogsDataTable filters={{ sourceOrTargetUserId: userId }} pageSize={25}
                       enableDelete={ access.can('system.logs', 'delete') } />
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Logs', { user: 'id' }, 'Accounts', 'Organisation');
