// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';
import { forbidden, notFound } from 'next/navigation'

import { Markdown } from '@components/Markdown';
import { RegistrationContentContainer } from '@app/registration/RegistrationContentContainer';
import { RegistrationLayout } from '../registration/RegistrationLayout';
import { determineEnvironment } from '@lib/Environment';
import { getAuthenticationContext } from '@lib/auth/AuthenticationContext';
import { getStaticContent } from '@lib/Content';

/**
 * Root component for the /guide page, which displays the personalised Volunteer Guide. The goal
 * of this guide is to answer the most frequently asked questions by participating volunteers.
 */
export default async function GuidePage(props: PageProps<'/guide'>) {
    const searchParams = await props.searchParams;

    const environment = await determineEnvironment();
    if (!environment)
        notFound();

    const authenticationContext = await getAuthenticationContext();
    if (!authenticationContext.user || !authenticationContext.events.size)
        forbidden();

    let guideTeamSlug: string;
    if (searchParams.hasOwnProperty('environment')) {
        // TODO: `guideTeamSlug` can end up being string[] or undefined as well
        guideTeamSlug = searchParams['environment'] as string;
    } else {
        // TODO: This is a very fragile way of determining the most recent team
        const mostRecentEventSlug = [ ...authenticationContext.events.keys() ].sort().pop()!;
        guideTeamSlug = authenticationContext.events.get(mostRecentEventSlug)!;
    }

    const substitutions = {
        name: authenticationContext.user.displayName || authenticationContext.user.firstName,
    };

    const globalContent = await getStaticContent([ 'guide/common' ], substitutions);
    const envContent = await getStaticContent([ `guide/${guideTeamSlug}` ], substitutions);

    if (!globalContent)
        notFound();

    return (
        <RegistrationLayout environment={environment}>
            <RegistrationContentContainer title="Volunteering Guide"
                                          user={authenticationContext.user}>
                { !!envContent &&
                    <Markdown sx={{ p: 2, pb: 0 }}>{envContent.markdown}</Markdown> }
                <Markdown sx={{ p: 2 }}>{globalContent.markdown}</Markdown>
            </RegistrationContentContainer>
        </RegistrationLayout>
    );
}

export const metadata: Metadata = {
    title: 'Volunteering Guide | AnimeCon Volunteering Teams',
};
