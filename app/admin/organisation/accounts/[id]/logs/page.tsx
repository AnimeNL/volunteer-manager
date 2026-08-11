// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import { AccountStatusButton } from '../AccountStatusButton';
import { LogsDataTable } from '@app/admin/system/diagnostics/logs/LogsDataTable';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tUsers } from '@lib/database';

/**
 * The <AccountLogsPage> component displays log events that were recorded by the holder of this
 * account, both through their own actions and through actions that affected them.
 */
export default async function AccountLogsPage(
    props: PageProps<'/admin/organisation/accounts/[id]/logs'>)
{
    await requireAuthenticationContext({
        check: 'admin',
        permission: {
            permission: 'system.logs',
            operation: 'read',
        },
    });

    const { id } = await props.params;

    const account = await db.selectFrom(tUsers)
        .where(tUsers.userId.equals(parseInt(id, /* radix= */ 10) || 0))
            .and(tUsers.anonymized.isNull())
        .select({
            id: tUsers.userId,
            name: tUsers.name,
            activated: tUsers.activated.equals(/* true= */ 1),
            restricted: tUsers.participationSuspended,
        })
        .executeSelectNoneOrOne();

    if (!account)
        notFound();

    return (
        <>
            <Section icon={ <InfoOutlinedIcon color="primary" /> } title="Logs"
                     headerAction={
                         <AccountStatusButton activated={account.activated}
                                              restricted={account.restricted} />
                     }
                     breadcrumbs={[
                         { label: 'Organisation', href: '/admin/organisation' },
                         { label: 'Accounts', href: '/admin/organisation/accounts' },
                         { label: account.name, href: `/admin/organisation/accounts/${account.id}` },
                         { label: 'Logs' },
                     ]}>
                <SectionIntroduction>
                    Actions involving {account.name} on the Volunteer Manager.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                <LogsDataTable pageSize={25} userId={account.id} />
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Logs', { user: 'id' }, 'Accounts', 'Organisation');
