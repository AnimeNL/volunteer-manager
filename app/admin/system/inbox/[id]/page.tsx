// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import Alert from '@mui/material/Alert';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthentication } from '@lib/requireAuthentication';
import db, { tEmailAccounts } from '@lib/database';

/**
 * Page displaying the inbox for an individual inbound e-mail account.
 */
export default async function EmailInboxPage(props: PageProps<'/admin/system/inbox/[id]'>) {
    await requireAuthentication('system.integrations');

    const params = await props.params;

    const accountId = parseInt(params.id, /* radix= */ 10);
    if (!Number.isSafeInteger(accountId))
        notFound();

    const account = await db.selectFrom(tEmailAccounts)
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

    return (
        <>
            <Section icon={ <InboxOutlinedIcon color="primary" /> } title={account.address}
                     breadcrumbs={[
                         { label: 'E-mail' },
                         { label: account.address },
                     ]}>
                <SectionIntroduction>
                    Incoming messages received for the <strong>{account.address}</strong> e-mail
                    account.
                </SectionIntroduction>
            </Section>
            <Alert severity="warning" variant="filled">
                Inbox functionality is not available yet.
            </Alert>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn({ param: 'id' }, 'E-mail');
