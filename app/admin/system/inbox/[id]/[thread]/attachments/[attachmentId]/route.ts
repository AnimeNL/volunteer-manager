// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { NextRequest } from 'next/server';
import { forbidden, notFound } from 'next/navigation';

import { canAccessInbox } from '@app/admin/system/inbox/InboxAccess';
import { requireAuthentication } from '@lib/requireAuthentication';
import db, { tEmailAccounts, tInboxEmail, tInboxEmailAttachments, tInboxThreads } from '@lib/database';

/**
 * Serves an inbound e-mail attachment as an authenticated download for users who have read access
 * to the owning inbox.
 */
export async function GET(
    _request: NextRequest,
    context: RouteContext<'/admin/system/inbox/[id]/[thread]/attachments/[attachmentId]'>)
{
    const authContext = await requireAuthentication('system.inbox.eligible');

    const params = await context.params;
    const accountId = parseInt(params.id, /* radix= */ 10);
    const threadId = parseInt(params.thread, /* radix= */ 10);
    const attachmentId = parseInt(params.attachmentId, /* radix= */ 10);

    if (!Number.isSafeInteger(accountId) || !Number.isSafeInteger(threadId) ||
            !Number.isSafeInteger(attachmentId))
    {
        notFound();
    }

    if (!await canAccessInbox(authContext, accountId, 'read'))
        forbidden();

    const attachment = await db.selectFrom(tInboxEmailAttachments)
        .innerJoin(tInboxEmail)
            .on(tInboxEmail.inboxEmailId.equals(tInboxEmailAttachments.inboxEmailId))
                .and(tInboxEmail.inboxDeleted.isNull())
        .innerJoin(tInboxThreads)
            .on(tInboxThreads.inboxThreadId.equals(tInboxEmail.inboxThreadId))
                .and(tInboxThreads.threadDeleted.isNull())
        .innerJoin(tEmailAccounts)
            .on(tEmailAccounts.emailAccountId.equals(tInboxThreads.emailAccountId))
                .and(tEmailAccounts.emailAccountDeleted.isNull())
                .and(tEmailAccounts.emailAccountImapHostname.isNotNull())
                .and(tEmailAccounts.emailAccountImapHostname.notEquals(''))
        .where(tInboxEmailAttachments.inboxAttachmentId.equals(attachmentId))
            .and(tInboxEmail.inboxThreadId.equals(threadId))
            .and(tInboxThreads.emailAccountId.equals(accountId))
            .and(tInboxEmailAttachments.attachmentData.isNotNull())
        .select({
            data: tInboxEmailAttachments.attachmentData,
            filename: tInboxEmailAttachments.attachmentFilename,
            mimeType: tInboxEmailAttachments.attachmentMimeType,
        })
        .executeSelectNoneOrOne();

    if (!attachment?.data)
        notFound();

    const rawFilename = attachment.filename?.trim() || `attachment-${attachmentId}`;
    const asciiFilename = rawFilename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
    const encodedFilename = encodeURIComponent(rawFilename);

    return new Response(attachment.data, {
        headers: {
            'Cache-Control': 'private, no-store',
            'Content-Disposition':
                `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`,
            'Content-Length': String(attachment.data.byteLength),
            'Content-Type': attachment.mimeType || 'application/octet-stream',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}
