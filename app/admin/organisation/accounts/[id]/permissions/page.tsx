// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import { AccountPermissions } from './AccountPermissions';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

/**
 * The <AccountPermissions> component displays the permissions that have been set for this account.
 * When the signed in user has sufficient rights, they can modify the permissions as well.
 */
export default async function AccountPermissionsPage(
    props: PageProps<'/admin/organisation/accounts/[id]/permissions'>)
{
    const { access } = await requireAuthenticationContext({
        check: 'admin',
        permission: {
            permission: 'organisation.permissions',
            operation: 'read',
        },
    });

    const userId = parseInt((await props.params).id, /* radix= */ 10);
    if (!Number.isSafeInteger(userId))
        notFound();

    const readOnly = !access.can('organisation.permissions', 'update');
    return <AccountPermissions access={access} readOnly={readOnly} userId={userId} />
}

export const generateMetadata =
    createGenerateMetadataFn('Permissions', { user: 'id' }, 'Accounts', 'Organisation');
