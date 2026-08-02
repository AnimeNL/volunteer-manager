// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';
import { notFound } from 'next/navigation';

import { default as MuiLink } from '@mui/material/Link';
import DrawIcon from '@mui/icons-material/Draw';
import FeedOutlinedIcon from '@mui/icons-material/FeedOutlined';

import { ContentCreate } from '@app/admin/system/content/ContentCreate';
import { ContentList } from '@app/admin/system/content/ContentList';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createEventScope } from '@app/admin/system/content/ContentScope';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationContextWithEventAndTeam }
    from '../../../requireAuthenticationContextWithEventAndTeam';

import { createContent } from '@app/admin/system/content/ContentActions';

/**
 * The <EventTeamWebsiteContentPage> page shows the content pages that exist on the domain that's
 * managed by the [team] indicated in the slug.
 */
export default async function EventTeamWebsiteContentPage(
    props: PageProps<'/admin/events/[event]/[team]/website/content'>)
{
    const { event, team } = await requireAuthenticationContextWithEventAndTeam(props);
    if (!team.flags.managesContent)
        notFound();

    const pathPrefix = `/registration/${event.slug}/`;
    const linkPrefix = './content/';

    const scope = createEventScope(event.id, team.id);

    const createFn = createContent.bind(null, scope, linkPrefix);

    return (
        <>
            <Section icon={ <FeedOutlinedIcon color="primary" /> } title="Content"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: team.title, href: `/admin/events/${event.slug}/${team.slug}` },
                         {
                            label: 'Website',
                            href: `/admin/events/${event.slug}/${team.slug}/website`,
                         },
                         { label: 'Content' },
                     ]}>
                <SectionIntroduction>
                    Content management system for{' '}
                    <MuiLink component={Link} target="_blank"
                             href={`https://${team.domain}/registration/${event.slug}`}>
                        {team.domain}
                    </MuiLink> for {event.shortName}.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                <ContentList linkPrefix="./content/" pathPrefix={pathPrefix} scope={scope} />
            </Section>
            <Section icon={ <DrawIcon /> } title="Create a new page">
                <ContentCreate createFn={createFn} pathPrefix={pathPrefix} />
            </Section>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn(
    'Content', 'Website', { team: 'team' }, { event: 'event' });
