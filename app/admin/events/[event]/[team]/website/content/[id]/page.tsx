// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';
import { notFound } from 'next/navigation';

import { default as MuiLink } from '@mui/material/Link';
import FeedOutlinedIcon from '@mui/icons-material/FeedOutlined';

import { ContentEditor } from '@app/admin/system/content/ContentEditor';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createEventScope } from '@app/admin/system/content/ContentScope';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationContextWithEventAndTeam }
    from '@app/admin/events/[event]/requireAuthenticationContextWithEventAndTeam';
import db, { tContent } from '@lib/database';

import { fetchContent, updateContent } from '@app/admin/system/content/ContentActions';

/**
 * The <EventWebsiteContentPage> page enables the content on an individual page to be updated as
 * desired. The common content editing framework is used for this feature.
 */
export default async function EventWebsiteContentPage(
    props: PageProps<'/admin/events/[event]/[team]/website/content/[id]'>)
{
    const { event, team } = await requireAuthenticationContextWithEventAndTeam(props);
    if (!team.flags.managesContent)
        notFound();

    const params = await props.params;
    const pathPrefix = `/registration/${event.slug}/`;

    const contentId = parseInt(params.id, /* radix= */ 10);
    const scope = createEventScope(event.id, team.id);

    // ---------------------------------------------------------------------------------------------

    const content = await db.selectFrom(tContent)
        .where(tContent.contentId.equals(contentId))
            .and(tContent.eventId.equals(scope.eventId))
            .and(tContent.teamId.equals(scope.teamId))
            .and(tContent.contentType.equals(scope.type))
        .select({
            title: tContent.contentTitle,
            path: tContent.contentPath,
        })
        .executeSelectNoneOrOne();

    if (!content)
        notFound();

    // ---------------------------------------------------------------------------------------------

    const href = `https://${team.domain}/registration/${event.slug}/${content.path}`;

    const fetchFn = fetchContent.bind(null, scope, contentId);
    const updateFn = updateContent.bind(null, scope, contentId);

    return (
        <>
            <Section icon={ <FeedOutlinedIcon color="primary" /> } title={content.title}
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: team.title, href: `/admin/events/${event.slug}/${team.slug}` },
                         {
                             label: 'Website',
                             href: `/admin/events/${event.slug}/${team.slug}/website`,
                         },
                         {
                             label: 'Content',
                             href: `/admin/events/${event.slug}/${team.slug}/website/content`,
                         },
                         { label: content.title },
                     ]}>
                <SectionIntroduction>
                    Content management system for the{' '}
                    <MuiLink component={Link} target="_blank" href={href}>{content.title}</MuiLink>
                    {' '}page for {event.shortName}.
                </SectionIntroduction>
            </Section>
            <ContentEditor fetchFn={fetchFn} pathPrefix={pathPrefix} updateFn={updateFn} noHeader />
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn(
    'Content', 'Website', { team: 'team' }, { event: 'event' });
