// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import { ContentEditor } from '@app/admin/system/content/ContentEditor';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { createKnowledgeBaseScope } from '@app/admin/system/content/ContentScope';
import { requireAuthenticationWithEventAndTeam } from '@lib/requireAuthentication';
import db, { tContent, tContentCategories } from '@lib/database';

import { fetchContent, updateContent } from '@app/admin/system/content/ContentActions';

/**
 * This page displays an individual FAQ entry, which allows the volunteer to change both the
 * question and the answer to the question. A rich text editing component is made available.
 */
export default async function EventFaqEntryPage(
    props: PageProps<'/admin/events/[event]/[team]/knowledge/[id]'>)
{
    const { event, team } = await requireAuthenticationWithEventAndTeam(props);
    if (!team.flags.managesKnowledgeBase)
        notFound();

    const params = await props.params;
    const contentId = parseInt(params.id, /* radix= */ 10);
    if (!Number.isSafeInteger(contentId))
        notFound();

    const scope = createKnowledgeBaseScope(event.id);

    // ---------------------------------------------------------------------------------------------

    const content = await db.selectFrom(tContent)
        .where(tContent.contentId.equals(contentId))
            .and(tContent.eventId.equals(scope.eventId))
            .and(tContent.teamId.equals(scope.teamId))
            .and(tContent.contentType.equals(scope.type))
        .select({
            title: tContent.contentTitle,
        })
        .executeSelectNoneOrOne();

    if (!content)
        notFound();

    // ---------------------------------------------------------------------------------------------

    const categories = await db.selectFrom(tContentCategories)
        .where(tContentCategories.eventId.equals(event.id))
            .and(tContentCategories.categoryDeleted.isNull())
        .select({
            id: tContentCategories.categoryId,
            label: tContentCategories.categoryTitle,
        })
        .orderBy(tContentCategories.categoryOrder, 'asc')
        .executeSelectMany();

    const fetchFn = fetchContent.bind(null, scope, contentId);
    const updateFn = updateContent.bind(null, scope, contentId);

    return (
        <>
            <Section icon={ <InfoOutlinedIcon color="primary" /> } title={content.title}
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: team.title, href: `/admin/events/${event.slug}/${team.slug}` },
                         {
                             label: 'Knowledge base',
                             href: `/admin/events/${event.slug}/${team.slug}/knowledge`,
                         },
                         { label: content.title },
                     ]}>
                <SectionIntroduction>
                    A frequently asked question by people who attend AnimeCon. Please be brief in
                    your answer.
                </SectionIntroduction>
            </Section>
            <ContentEditor categories={categories} fetchFn={fetchFn} pathHidden updateFn={updateFn}
                           noHeader />
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Knowledge base', { team: 'team' }, { event: 'event' });
