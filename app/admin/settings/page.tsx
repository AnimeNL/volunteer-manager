// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';

import { AccountSettingsForm, type AccountSettings } from '../organisation/accounts/[id]/settings/AccountSettings';
import { Section } from '../components/Section';
import { SectionIntroduction } from '../components/SectionIntroduction';
import { FormGridSection } from '../components/FormGridSection';
import { readUserSettings } from '@lib/UserSettings';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

import { updateAccountSettings } from '../organisation/accounts/[id]/AccountActions';

/**
 * The <AccountSettingsPage> component enables a user to change the settings associated with their
 * account. These settings are global across AnimeCon Volunteer Manager sessions and instances.
 */
export default async function AccountSettingsPage() {
    const { user } = await requireAuthenticationContext({ check: 'admin' });

    const settings = await readUserSettings(user.id, [
            'ai-example-messages',
            'user-admin-experimental-dark-mode',
            'user-admin-experimental-layout',
            'user-admin-experimental-responsive',
            'user-ai-example-messages-promo-time',
        ], /* disableFallback= */ true);

    const defaultValues: AccountSettings = {
        exampleMessages: settings['ai-example-messages'] ?? [ /* no example messages */ ],
        experimentalDarkMode: !!settings['user-admin-experimental-dark-mode'],
        experimentalLayout: !!settings['user-admin-experimental-layout'],
        experimentalResponsive: !!settings['user-admin-experimental-responsive'],
    };

    const saveSettingsFn = updateAccountSettings.bind(null, user.id);

    return (
        <>
            <Section icon={ <ManageAccountsIcon color="primary" />} title="Account settings"
                     breadcrumbs={[ { label: 'Account settings' } ]}>
                <SectionIntroduction>
                    Any changes you make here will be saved across your sessions, directly affecting
                    how the Volunteer Manager works for you.
                </SectionIntroduction>
            </Section>
            <FormGridSection noHeader action={saveSettingsFn} defaultValues={defaultValues}>
                <AccountSettingsForm />
            </FormGridSection>
        </>
    );
}
    
export const metadata: Metadata = {
    title: 'Account settings | AnimeCon Volunteer Manager',
};
