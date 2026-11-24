// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound, redirect } from 'next/navigation';

import { determineEnvironment } from '@lib/Environment';
import { getEnvironmentContext } from '@lib/EnvironmentContext';

/**
 * The <RegistrationPage> component does not own content, but will redirect the user to the earliest
 * event that they're able to join. This page can also be reached through "/hello".
 */
export default async function RegistrationPage() {
    const environment = await determineEnvironment();
    if (!environment)
        notFound();

    const context = await getEnvironmentContext(environment);
    for (const event of context.events) {
        if (event.publishContent !== 'active' && event.publishContent !== 'override')
            continue;

        redirect(`/registration/${event.slug}`);
    }

    redirect('/');
}
