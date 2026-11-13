// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { forbidden, notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { ImportEmailTask } from '@lib/scheduler/tasks/ImportEmailTask';
import { canAccessInbox } from './InboxAccess';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { executeServerAction } from '@lib/serverAction';

/**
 * Zod type that describes that no data is expected.
 */
const kNoDataRequired = z.object({ /* no parameters */ });

/**
 * Server Action that manually triggers an IMAP synchronization for the inbound e-mail account
 * identified by `accountId`.
 */
export async function synchronizeInbox(accountId: number, formData: unknown) {
    return executeServerAction(formData, kNoDataRequired, async (data, props) => {
        executeAccessCheck(props.authenticationContext, 'system.inbox.eligible');

        if (!Number.isSafeInteger(accountId))
            notFound();

        if (!props.authenticationContext.user ||
                !await canAccessInbox(props.authenticationContext, accountId, 'read'))
        {
            forbidden();
        }

        const synchronized = await ImportEmailTask.synchronizeAccount(accountId);
        if (!synchronized) {
            return {
                success: false,
                error: 'Incoming e-mail is not configured for this account.',
            };
        }

        return { success: true };
    });
}
