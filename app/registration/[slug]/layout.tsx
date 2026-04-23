// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { forbidden, notFound, unauthorized } from 'next/navigation';

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
    for (const candidate of context.events) {
        if (candidate.slug !== params.slug)
            continue;

        if (candidate.publishContent !== 'active' && candidate.publishContent !== 'override') {
            !!context.user ? forbidden()
                           : unauthorized();
        }

        event = candidate;
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
