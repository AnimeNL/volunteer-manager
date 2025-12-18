// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound, unauthorized } from 'next/navigation';

import { ApplicationProgressHeader } from '@app/welcome/ApplicationProgressHeader';
import { RegistrationContentContainer } from '../RegistrationContentContainer';
import { RegistrationLayout } from '../RegistrationLayout';
import { determineEnvironment } from '@lib/Environment';
import { getEnvironmentContext, type EnvironmentContextEventAccess } from '@lib/EnvironmentContext';

/**
 * Root layout for the registration page belonging to a particular event.
 */
export default async function RegistrationEventLayout(props: LayoutProps<'/registration/[slug]'>) {
    const environment = await determineEnvironment();
    if (!environment)
        notFound();

    const context = await getEnvironmentContext(environment);
    const params = await props.params;

    let event: EnvironmentContextEventAccess | undefined;
    for (const eventCandidate of context.events) {
        if (eventCandidate.slug !== params.slug)
            continue;

        let access: boolean = false;
        for (const team of eventCandidate.teams) {
            if (team.registration === 'active' || team.registration === 'override')
                access = true;
        }

        if (!access)
            unauthorized();

        event = eventCandidate;
        break;
    }

    if (!event)
        notFound();

    return (
        <RegistrationLayout environment={environment}>
            <RegistrationContentContainer title={event.name}
                                          redirectUrl={`/registration/${event.slug}/application`}
                                          user={context.user}>

                <ApplicationProgressHeader context={context} event={event.slug} />

                {props.children}

            </RegistrationContentContainer>
        </RegistrationLayout>
    );
}
