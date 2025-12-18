// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import { EventApplicationStatus } from './EventApplicationStatus';
import { determineEnvironment } from '@lib/Environment';
import { generatePortalMetadataFn } from '@app/registration/generatePortalMetadataFn';
import { getEnvironmentContext } from '@lib/EnvironmentContext';

/**
 * The <EventApplicationStatusPage> displays the status of an individual application the visitor has
 * made for one of our events and teams, incidated through params in the URL.
 */
export default async function EventApplicationStatusPage(
    props: PageProps<'/registration/[slug]/application/[team]'>)
{
    const environment = await determineEnvironment();
    if (!environment)
        notFound();

    const params = await props.params;

    const context = await getEnvironmentContext(environment);
    const event = context.events.find(event => event.slug === params.slug);

    if (!event)
        notFound();

    return (
        <EventApplicationStatus context={context} environment={environment} event={event}
                                team={params.team} />
    );
}

export const generateMetadata = generatePortalMetadataFn('Application');
