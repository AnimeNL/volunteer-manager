// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden, notFound } from 'next/navigation';

import Alert from '@mui/material/Alert';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';

import { InlineAccountLink } from '@app/admin/components/InlineAccountLink';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { canAccessInbox } from '../../InboxAccess';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthentication } from '@lib/requireAuthentication';
import db, { tEmailAccounts, tInboxThreads, tUsers } from '@lib/database';

/**
 * Page displaying an individual inbound e-mail thread.
 */
export default async function EmailInboxThreadPage(
    props: PageProps<'/admin/system/inbox/[id]/[thread]'>)
{
    const context = await requireAuthentication('system.inbox.eligible');

    const params = await props.params;

    const accountId = parseInt(params.id, /* radix= */ 10);
    const threadId = parseInt(params.thread, /* radix= */ 10);
    if (!Number.isSafeInteger(accountId) || !Number.isSafeInteger(threadId))
        notFound();

    const dbInstance = db;
    const account = await dbInstance.selectFrom(tEmailAccounts)
        .where(tEmailAccounts.emailAccountId.equals(accountId))
            .and(tEmailAccounts.emailAccountDeleted.isNull())
            .and(tEmailAccounts.emailAccountImapHostname.isNotNull())
            .and(tEmailAccounts.emailAccountImapHostname.notEquals(''))
        .select({
            id: tEmailAccounts.emailAccountId,
            address: tEmailAccounts.emailAccountAddress,
        })
        .executeSelectNoneOrOne();

    if (!account)
        notFound();

    if (!await canAccessInbox(context, account.id, 'read'))
        forbidden();

    const senderUserJoin = tUsers.forUseInLeftJoin();

    const thread = await dbInstance.selectFrom(tInboxThreads)
        .leftJoin(senderUserJoin)
            .on(senderUserJoin.userId.equals(tInboxThreads.threadFromUserId))
                .and(senderUserJoin.anonymized.isNull())
        .where(tInboxThreads.inboxThreadId.equals(threadId))
            .and(tInboxThreads.emailAccountId.equals(account.id))
            .and(tInboxThreads.threadDeleted.isNull())
        .select({
            id: tInboxThreads.inboxThreadId,
            subject: tInboxThreads.threadSubject,
            sender: {
                id: senderUserJoin.userId,
                name: senderUserJoin.name
                    .valueWhenNull(tInboxThreads.threadFromName.nullIfValue(''))
                    .valueWhenNull(tInboxThreads.threadFromAddress.nullIfValue(''))
                    .valueWhenNull('Unknown'),
            },
        })
        .executeSelectNoneOrOne();

    if (!thread)
        notFound();

    const subject = thread.subject || '(no subject)';
    const sender = {
        id: thread.sender.id ?? undefined,
        name: thread.sender.name,
    };

    return (
        <>
            <Section icon={ <InboxOutlinedIcon color="primary" /> } title={subject}
                     breadcrumbs={[
                         { label: 'E-mail' },
                         { label: account.address, href: `/admin/system/inbox/${account.id}` },
                         { label: `#${thread.id}` },
                     ]}>
                <SectionIntroduction>
                    Conversation with <InlineAccountLink user={sender} /> in the{' '}
                    <strong>{account.address}</strong> inbox.
                </SectionIntroduction>
            </Section>
            <Alert severity="warning" variant="filled">
                Thread functionality is not available yet.
            </Alert>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn(
    { param: 'thread', prefix: '#' }, { emailAccount: 'id' }, 'E-mail');
