// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import CategoryIcon from '@mui/icons-material/Category';

import { AccountPermissionSelector } from '@app/admin/system/permissions/AccountPermissionSelector';
import { AccountStatusButton } from '../AccountStatusButton';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthentication } from '@lib/requireAuthentication';
import db, { tUsers } from '@lib/database';

import { updateAccountPermissions } from '@app/admin/system/permissions/PermissionActions';

/**
 * The <AccountPermissionSelector> component displays the permissions that have been set for this
 * account. When the signed in user has sufficient rights, they can modify the permissions as well.
 */
export default async function AccountPermissionsPage(
    props: PageProps<'/admin/organisation/accounts/[id]/permissions'>)
{
    const { access } = await requireAuthentication({
        permission: 'organisation.accounts',
        operation: 'read',
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

    const action = updateAccountPermissions.bind(null, account.id);

    const readOnly = !access.can('system.permissions');

    return (
        <>
            <Section icon={ <CategoryIcon color="primary" /> } title="Permissions"
                     headerAction={
                         <AccountStatusButton activated={account.activated}
                                              restricted={account.restricted} />
                     }
                     breadcrumbs={[
                         { label: 'Organisation', href: '/admin/organisation' },
                         { label: 'Accounts', href: '/admin/organisation/accounts' },
                         { label: account.name, href: `/admin/organisation/accounts/${account.id}` },
                         { label: 'Permissions' },
                     ]}>
                <SectionIntroduction>
                    Permissions granted to {account.name} across the Volunteer Manager.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                <AccountPermissionSelector access={access} action={action} readOnly={readOnly}
                                           userId={account.id} />
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Permissions', { user: 'id' }, 'Accounts', 'Organisation');
