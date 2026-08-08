// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';

import { AccountSettingsForm, type AccountSettings } from './AccountSettings';
import { FormGridSection } from '@app/admin/components/FormGridSection';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { readUserSettings } from '@lib/UserSettings';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tUsers } from '@lib/database';

import { updateAccountSettings } from '../AccountActions';

/**
 * The <AccountSettingsPage> component displays the settings that have been associated with this
 * profile. It defers to a component that's available in other places of the admin area as well.
 */
export default async function AccountSettingsPage(
    props: PageProps<'/admin/organisation/accounts/[id]/settings'>)
{
    const { access } = await requireAuthenticationContext({
        check: 'admin',
        permission: {
            permission: 'organisation.accounts',
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
        })
        .executeSelectNoneOrOne();

    if (!account)
        notFound();

    const readOnly = !access.can('organisation.accounts', 'update');

    const userSettings = await readUserSettings(account.id, [
        'ai-example-messages',
        'user-admin-experimental-layout',
    ], /* disableFallback= */ true);

    const defaultValues: AccountSettings = {
        exampleMessages: userSettings['ai-example-messages'] ?? [ /* no example messages */ ],
        experimentalLayout: !!userSettings['user-admin-experimental-layout'],
    };

    const updateSettingsFn = updateAccountSettings.bind(null, account.id);

    return (
        <>
            <Section icon={ <SettingsOutlinedIcon color="primary" /> } title="Settings"
                     breadcrumbs={[
                         { label: 'Organisation', href: '/admin/organisation' },
                         { label: 'Accounts', href: '/admin/organisation/accounts' },
                         { label: account.name, href: `/admin/organisation/accounts/${account.id}` },
                         { label: 'Settings' },
                     ]}>
                <SectionIntroduction>
                    Account settings for {account.name} on the Volunteer Manager. Changes will take
                    effect immediately.
                </SectionIntroduction>
            </Section>
            <FormGridSection noHeader tabs action={updateSettingsFn} defaultValues={defaultValues}>
                <AccountSettingsForm readOnly={readOnly} />
            </FormGridSection>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Settings', { user: 'id' }, 'Accounts', 'Organisation');
