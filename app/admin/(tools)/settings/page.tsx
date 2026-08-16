// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';
import { z } from 'zod/v4';

import { TextFieldElement } from '@components/proxy/react-hook-form-mui';

import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';

import { GeminiIcon } from '@app/admin/components/icons/GeminiIcon';
import { LayoutToggle } from './LayoutToggle';
import { Section } from '../../components/Section';
import { SectionIntroduction } from '../../components/SectionIntroduction';
import { FormGridSection } from '../../components/FormGridSection';
import { executeServerAction } from '@lib/serverAction';
import { readUserSettings } from '@lib/UserSettings';
import { requireAuthentication } from '@app/admin/lib/requireAuthentication';
import { writeUserSetting } from '@lib/UserSettings';

import { updateAccountSettings } from '../../organisation/accounts/[id]/AccountActions';

/**
 * Maximum number of examples messages that can be provided by the user.
 */
const kExampleMessageCount = 5;

/**
 * Server Action through which a user's opt-in state for the experimental layout can be updated.
 */
async function updateExperimentalLayoutOptIn(formData: unknown) {
    'use server';
    return executeServerAction(formData, z.object({ optIn: z.boolean() }), async (data, props) => {
        await writeUserSetting(props.user.id, 'user-admin-experimental-layout', data.optIn);
        return { success: true };
    });
}

/**
 * The <AccountSettingsPage> component enables a user to change the settings associated with their
 * account. These settings are global across AnimeCon Volunteer Manager sessions and instances.
 */
export default async function AccountSettingsPage() {
    const { user } = await requireAuthentication();

    const settings = await readUserSettings(user.id, [
        'ai-example-messages',
    ], /* disableFallback= */ true);

    const defaultValues = {
        exampleMessages: settings['ai-example-messages'] ?? [ /* no example messages */ ],
    };

    const saveSettingsFn = updateAccountSettings.bind(null, user.id);

    return (
        <>
            <Section icon={ <ManageAccountsIcon color="primary" />} title="Your settings"
                     breadcrumbs={[ { label: 'Your settings' } ]}>
                <SectionIntroduction>
                    Personalise the behaviour of the Volunteer Manager to make it work better for
                    you.
                </SectionIntroduction>
            </Section>
            <Section highlight noHeader>
                <LayoutToggle action={updateExperimentalLayoutOptIn} />
            </Section>
            <FormGridSection icon={ <GeminiIcon /> } title="Personalised AI"
                             action={saveSettingsFn} defaultValues={defaultValues}>
                <Grid size={{ xs: 12 }}>
                    <SectionIntroduction>
                        Provide up to five of the favourite e-mails you've written to help AI write
                        better e-mail drafts on your behalf. Provide both Dutch and English
                        examples, and it doesn't matter what they're about!
                    </SectionIntroduction>
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <Divider />
                </Grid>
                { Array(kExampleMessageCount).fill(null).map((_, index) =>
                    <TextFieldElement key={index} name={`exampleMessages[${index}]`}
                                      label={`Example message ${index + 1}`}
                                      fullWidth size="small" multiline maxRows={6} /> )}
            </FormGridSection>
        </>
    );
}

export const metadata: Metadata = {
    title: 'Account settings | AnimeCon Volunteer Manager',
};
