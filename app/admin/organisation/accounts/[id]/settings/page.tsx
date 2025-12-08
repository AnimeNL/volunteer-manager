// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import type { NextPageParams } from '@lib/NextRouterParams';
import { AccountSettingsForm, type AccountSettings } from './AccountSettings';
import { FormGrid } from '@app/admin/components/FormGrid';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import { updateAccountSettings } from '../AccountActions';
import { readUserSettings } from '@lib/UserSettings';

/**
 * The <AccountSettingsPage> component displays the settings that have been associated with this
 * profile. It defers to a component that's available in other places of the admin area as well.
 */
export default async function AccountSettingsPage(props: NextPageParams<'id'>) {
    const { access } = await requireAuthenticationContext({
        check: 'admin',
        permission: {
            permission: 'organisation.accounts',
            operation: 'read',
        },
    });

    const userId = parseInt((await props.params).id, /* radix= */ 10);
    if (!Number.isSafeInteger(userId))
        notFound();

    const userSettings = await readUserSettings(userId, [
        'ai-example-messages',
        'user-admin-experimental-dark-mode',
        'user-admin-experimental-responsive',
    ], /* disableFallback= */ true);

    const defaultValues: AccountSettings = {
        exampleMessages: userSettings['ai-example-messages'] ?? [ /* no example messages */ ],
        experimentalDarkMode: !!userSettings['user-admin-experimental-dark-mode'],
        experimentalResponsive: !!userSettings['user-admin-experimental-responsive'],
    };

    const readOnly = !access.can('organisation.accounts', 'update');
    const updateAccountSettingsFn = updateAccountSettings.bind(null, userId);

    return (
        <FormGrid action={updateAccountSettingsFn} defaultValues={defaultValues}>
            <AccountSettingsForm readOnly={readOnly} />
        </FormGrid>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Settings', { user: 'id' }, 'Accounts', 'Organisation');
