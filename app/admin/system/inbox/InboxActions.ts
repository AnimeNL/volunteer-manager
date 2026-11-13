// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { forbidden, notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { Cache } from '@lib/cache';
import { ImportEmailTask } from '@lib/scheduler/tasks/ImportEmailTask';
import { canAccessInbox } from './InboxAccess';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { executeServerAction } from '@lib/serverAction';
import db, { tInboxThreads } from '@lib/database';

/**
 * Zod type that describes that no data is expected.
 */
const kNoDataRequired = z.object({ /* no parameters */ });

/**
 * Zod type that describes the payload for updating a thread's resolution state.
 */
const kUpdateThreadStateData = z.object({
    resolved: z.boolean(),
});

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

        Cache.getInstance('AdminNavigationMenuCache').delete(`inbox/${props.user.id}`);

        return { success: true };
    });
}

/**
 * Server Action that updates whether an inbound e-mail thread is marked as completed (`resolved`)
 * or still needs action. Requires write (`create`) access to the owning inbox.
 */
export async function updateInboxThreadState(
    accountId: number, threadId: number, formData: unknown)
{
    return executeServerAction(formData, kUpdateThreadStateData, async (data, props) => {
        executeAccessCheck(props.authenticationContext, 'system.inbox.eligible');

        if (!Number.isSafeInteger(accountId) || !Number.isSafeInteger(threadId))
            notFound();

        if (!props.authenticationContext.user ||
                !await canAccessInbox(props.authenticationContext, accountId, 'create'))
        {
            forbidden();
        }

        const dbInstance = db;
        const existingThreadId = await dbInstance.selectFrom(tInboxThreads)
            .where(tInboxThreads.inboxThreadId.equals(threadId))
                .and(tInboxThreads.emailAccountId.equals(accountId))
                .and(tInboxThreads.threadDeleted.isNull())
            .selectOneColumn(tInboxThreads.inboxThreadId)
            .executeSelectNoneOrOne();

        if (!existingThreadId)
            return { success: false, error: 'The thread could not be found.' };

        await dbInstance.update(tInboxThreads)
            .set({
                threadResolved: data.resolved ? dbInstance.currentZonedDateTime() : null,
            })
            .where(tInboxThreads.inboxThreadId.equals(threadId))
                .and(tInboxThreads.emailAccountId.equals(accountId))
                .and(tInboxThreads.threadDeleted.isNull())
            .executeUpdate();

        return { success: true, refresh: true };
    });
}
