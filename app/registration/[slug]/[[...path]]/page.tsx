// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';
import { notFound } from 'next/navigation';

import { default as MuiLink } from '@mui/material/Link';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';

import type { NextPageParams } from '@lib/NextRouterParams';
import { Markdown } from '@components/Markdown';
import { determineEnvironment } from '@lib/Environment';
import { generatePortalMetadataFn } from '../../generatePortalMetadataFn';
import { getContent } from '@lib/Content';
import { getEnvironmentContext } from '@lib/EnvironmentContext';

/**
 * The <EventContentPage> component displays arbitrary content for a particular event. Senior+
 * volunteers can freely create content as they see fit, which will be served by this component.
 */
export default async function EventContentPage(props: NextPageParams<'slug', 'path'>) {
    const environment = await determineEnvironment();
    if (!environment)
        notFound();

    const params = await props.params;

    const context = await getEnvironmentContext(environment);
    const event = context.events.find(event => event.slug === params.slug);

    if (!event)
        notFound();

    // TODO: Bring back team capacity warnings?

    // ---------------------------------------------------------------------------------------------

    const content = await getContent(environment.domain, event.id, params.path ?? []);
    if (!content)
        notFound();

    if (!!params.path?.length) {
        return (
            <Stack spacing={2} sx={{ p: 2 }}>
                <Markdown>{content.markdown}</Markdown>
                <MuiLink component={Link} href={`/registration/${event.slug}`}>
                    « Previous page
                </MuiLink>
            </Stack>
        );
    }

    // ---------------------------------------------------------------------------------------------

    const { access } = context;

    const acceptsApplications = event.teams.some(team => {
        if (team.applications === 'active' || team.applications === 'override')
            return true;

        if (access.can('event.applications', 'create', { event: event.slug, team: team.slug }))
            return true;

        return false;
    });

    return (
        <Stack spacing={2} sx={{ p: 2 }}>

            <Markdown>{content.markdown}</Markdown>

            { (!event.applications.length && !!acceptsApplications) &&
                <Button component={Link} href={`/registration/${event.slug}/application`}
                        color="primary" variant="contained" sx={{ alignSelf: 'flex-start' }}>
                    Join the {event.shortName} team today!
                </Button> }

            { !!event.applications.length &&
                <Button component={Link} href={`/registration/${event.slug}/application`}
                        color="inherit" variant="contained" sx={{ alignSelf: 'flex-start' }}>
                    See the status of your application{ event.applications.length > 1 ? 's' : '' }
                </Button> }

        </Stack>
    );
}

export const generateMetadata = generatePortalMetadataFn();
