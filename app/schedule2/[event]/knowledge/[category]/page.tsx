// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

import { Header, HeaderAsyncSlot, HeaderTextSlot } from '../../components/Header';
import { KnowledgeBaseIcon } from '@components/KnowledgeBaseIcon';
import { KnowledgeQuestionItem } from './KnowledgeQuestionList';
import { Markdown } from '@components/Markdown';
import { Page, SuspenseReveal } from '../../components/Page';
import { RestrictedBadge } from '../../components/RestrictedBadge';
import { ScheduleListSkeleton } from '../../components/ScheduleListSkeleton';
import { ScheduleSection } from '../../components/ScheduleSection';
import { createScheduleMetadataFn } from '../../lib/generateScheduleMetadata';
import { getKnowledgeBaseCategory } from '../../lib/data/knowledgeData';
import { pluralize } from '../../lib/format';
import { requireScheduleAccess } from '../../lib/getScheduleAccess';

/**
 * Resolves the authenticated volunteer's access to the requested Knowledge Base category.
 */
async function resolveCategory(paramsPromise: Promise<{ category: string; event: string }>) {
    const { category: categoryParam, event: eventSlug } = await paramsPromise;
    const { access, event, user } = await requireScheduleAccess(eventSlug);

    const hasUnrestrictedAccess = access.can('event.knowledge', { event: event.slug });
    return await getKnowledgeBaseCategory(event.id, categoryParam, user.id, hasUnrestrictedAccess);
}

/**
 * Authenticates the request behind `<Suspense>` and renders all questions in the category.
 */
async function CategoryQuestionsContent(props: {
    params: Promise<{ category: string; event: string }>;
    searchParams: Promise<{ q?: string }>;
}) {
    const [ category, searchParams ] = await Promise.all([
        resolveCategory(props.params),
        props.searchParams,
    ]);

    if (!category)
        notFound();

    const selectedQuestion = typeof searchParams.q === 'string' ? searchParams.q : undefined;
    const countLabel = pluralize(category.questions.length, 'question');

    return (
        <ScheduleSection title={countLabel}>
            { category.questions.map(({ answer, id, question }) =>
                <KnowledgeQuestionItem
                    key={id}
                    defaultExpanded={selectedQuestion === id}
                    id={id}
                    question={question}>
                    <Markdown content={answer} variant="body2" />
                </KnowledgeQuestionItem> ) }
        </ScheduleSection>
    );
}

/**
 * Knowledge Base category detail page displaying all alphabetically sorted FAQ questions.
 */
export default function ScheduleKnowledgeCategoryPage(
    props: PageProps<'/schedule2/[event]/knowledge/[category]'>)
{
    return (
        <Page
            header={
                <Header
                    actions={
                        <HeaderAsyncSlot
                            resolve={async () => {
                                const category = await resolveCategory(props.params);
                                if (!category?.limited)
                                    return null;

                                return (
                                    <RestrictedBadge
                                        icon={ <LockOutlinedIcon fontSize="small" /> }
                                        mx={0.75}
                                        title="Access is limited" />
                                );
                            }} />
                    }
                    description={
                        <HeaderTextSlot
                            resolve={async () =>
                                (await resolveCategory(props.params))?.description ?? null}
                            width={200} />
                    }
                    icon={
                        <HeaderAsyncSlot
                            fallback={ <InfoOutlinedIcon /> }
                            resolve={async () => {
                                const category = await resolveCategory(props.params);
                                return category
                                    ? <KnowledgeBaseIcon variant={category.icon} />
                                    : <InfoOutlinedIcon />;
                            }} />
                    }
                    title={
                        <HeaderTextSlot
                            resolve={async () =>
                                (await resolveCategory(props.params))?.title ?? null}
                            width={150} />
                    } />
            }>
            <SuspenseReveal
                fallback={
                    <ScheduleListSkeleton
                        groups={[
                            { rows: [ 240, 190, 260, 210 ], titleWidth: 76 },
                        ]} />
                }>
                <CategoryQuestionsContent
                    params={props.params}
                    searchParams={props.searchParams} />
            </SuspenseReveal>
        </Page>
    );
}

export const generateMetadata =
    createScheduleMetadataFn({ category: 'category' }, 'Knowledge base', { event: 'event' });
export const instant = true;
export const prefetch = 'partial';
