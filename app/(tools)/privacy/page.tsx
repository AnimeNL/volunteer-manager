// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation'

import { Markdown } from '@components/Markdown';
import { RegistrationContentContainer } from '@app/registration/RegistrationContentContainer';
import { RegistrationLayout } from '../../registration/RegistrationLayout';
import { determineEnvironment } from '@lib/Environment';
import { getAuthenticationContext } from '@lib/auth/AuthenticationContext';
import { getStaticContent } from '@lib/Content';

/**
 * Root component for the /private page, which lists the GDPR and data collection policies of the
 * AnimeCon volunteer manager. The policies are stored in the database and rendered using Markdown
 * to make updating them - where needed - easier.
 */
export default async function PrivacyPage() {
    const environment = await determineEnvironment();
    if (!environment)
        notFound();

    const { user } = await getAuthenticationContext();

    const content = await getStaticContent([ 'privacy' ]);
    if (!content)
        notFound();

    return (
        <RegistrationLayout environment={environment}>
            <RegistrationContentContainer title="GDPR & Data Sharing Policies" user={user}>
                <Markdown sx={{ p: 2 }}>{content.markdown}</Markdown>
            </RegistrationContentContainer>
        </RegistrationLayout>
    );
}

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'GDPR & Data Sharing Policies | AnimeCon Volunteering Teams',
};
