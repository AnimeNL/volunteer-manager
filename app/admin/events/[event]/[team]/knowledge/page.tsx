// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import QuizOutlinedIcon from '@mui/icons-material/QuizOutlined';

import { CreateQuestionForm } from './CreateQuestionForm';
import { KnowledgeList } from './KnowledgeList';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { createKnowledgeBaseScope } from '@app/admin/system/content/ContentScope';
import { requireAuthenticationWithEventAndTeam } from '@lib/requireAuthentication';
import db, { tContentCategories } from '@lib/database';

import { createContent } from '@app/admin/system/content/ContentActions';

/**
 * The FAQ provides a library of questions that we've received, or may receive from our visitors. It
 * is made available through the Volunteer Portal for all volunteers to be able to conveniently
 * answer any questions that they may receive from Staff, visitors and guests alike.
 */
export default async function EventTeamKnowledgePage(
    props: PageProps<'/admin/events/[event]/[team]/knowledge'>)
{
    const { event, team } = await requireAuthenticationWithEventAndTeam(props);
    if (!team.flags.managesKnowledgeBase)
        notFound();

    const categories = await db.selectFrom(tContentCategories)
        .where(tContentCategories.eventId.equals(event.id))
            .and(tContentCategories.categoryDeleted.isNull())
        .select({
            id: tContentCategories.categoryId,
            label: tContentCategories.categoryTitle,
        })
        .orderBy(tContentCategories.categoryOrder, 'asc')
        .executeSelectMany();

    const scope = createKnowledgeBaseScope(event.id);

    const createFn = createContent.bind(null, scope, /* linkPrefix= */ './knowledge');

    return (
        <>
            <Section icon={ <InfoOutlinedIcon color="primary" /> } title="Knowledge base"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: team.title, href: `/admin/events/${event.slug}/${team.slug}` },
                         { label: 'Knowledge base' },
                     ]}>
                <SectionIntroduction>
                    The knowledge base is a library of questions we expect from our guests, visitors
                    and fellow volunteers, each with a prepared answer.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                <KnowledgeList scope={scope} />
            </Section>
            <Section icon={ <QuizOutlinedIcon /> } title="Create a new question">
                { !categories.length &&
                    <SectionIntroduction important>
                        You need to <strong>create a category</strong> before individual questions
                        can be added.
                    </SectionIntroduction> }
                { !!categories.length &&
                    <CreateQuestionForm categories={categories} createFn={createFn} /> }
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Knowledge base', { team: 'team' }, { event: 'event' });
