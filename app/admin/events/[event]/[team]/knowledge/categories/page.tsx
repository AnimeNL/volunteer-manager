// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import CategoryIcon from '@mui/icons-material/Category';

import { KnowledgeCategories } from './KnowledgeCategories';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationWithEventAndTeam } from '@lib/requireAuthentication';

/**
 * The category overview page displays all categories that questions in the knowledge base can be
 * associated with, and allows managing them.
 */
export default async function KnowledgeCategoriesPage(
    props: PageProps<'/admin/events/[event]/[team]/knowledge/categories'>)
{
    const { event, team } = await requireAuthenticationWithEventAndTeam(props);
    if (!team.flags.managesKnowledgeBase)
        notFound();

    // TODO: Re-enable reordering the rows when that's supported.

    return (
        <>
            <Section icon={ <CategoryIcon color="primary" /> } title="Categories"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: team.title, href: `/admin/events/${event.slug}/${team.slug}` },
                         {
                             label: 'Knowledge base',
                             href: `/admin/events/${event.slug}/${team.slug}/knowledge`,
                         },
                         { label: 'Categories' },
                     ]}>
                <SectionIntroduction>
                    Questions in the knowledge based are grouped by category, to make them easier
                    for people to navigate.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                <KnowledgeCategories event={event.slug} />
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Knowledge base', { team: 'team' }, { event: 'event' });
