// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';

import { Header } from '../../components/Header';
import { KnowledgeBaseIcon } from '@components/KnowledgeBaseIcon';
import { KnowledgeQuestionItem, KnowledgeQuestionList } from './KnowledgeQuestionList';
import { Markdown } from '@components/Markdown';
import { Page, SuspenseReveal } from '../../components/Page';
import { ScheduleListSkeleton } from '../../components/ScheduleListSkeleton';
import { SectionHeader } from '../../components/SectionHeader';
import { getKnowledgeBaseCategory } from '../../lib/data/knowledgeData';
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
 * Streams the resolved category icon into the page `<Header>`.
 */
async function CategoryIcon(props: { params: Promise<{ category: string; event: string }> }) {
    const category = await resolveCategory(props.params);
    if (!category)
        return <InfoOutlinedIcon />;

    return <KnowledgeBaseIcon variant={category.icon} />;
}

/**
 * Streams the resolved category title into the page `<Header>`.
 */
async function CategoryTitle(props: { params: Promise<{ category: string; event: string }> }) {
    const category = await resolveCategory(props.params);
    return category?.title ?? null;
}

/**
 * Streams the resolved category description into the page `<Header>`.
 */
async function CategoryDescription(
    props: { params: Promise<{ category: string; event: string }> })
{
    const category = await resolveCategory(props.params);
    return category?.description ?? null;
}

/**
 * Streams the restricted-access indicator into the page `<Header>` when the category is limited.
 */
async function CategoryHeaderActions(
    props: { params: Promise<{ category: string; event: string }> })
{
    const category = await resolveCategory(props.params);
    if (!category?.limited)
        return null;

    return (
        <Tooltip title="Access is limited">
            <LockOutlinedIcon
                aria-label="Access is limited"
                fontSize="small"
                sx={{ color: 'warning.main', mx: 0.75 }} />
        </Tooltip>
    );
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
    const countLabel = category.questions.length === 1
        ? '1 question'
        : `${category.questions.length} questions`;

    return (
        <Stack spacing={0.75} useFlexGap>
            <SectionHeader title={countLabel} />
            <KnowledgeQuestionList>
                { category.questions.map(({ answer, id, question }) =>
                    <KnowledgeQuestionItem
                        key={id}
                        defaultExpanded={selectedQuestion === id}
                        id={id}
                        question={question}>
                        <Markdown content={answer} variant="body2" />
                    </KnowledgeQuestionItem> ) }
            </KnowledgeQuestionList>
        </Stack>
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
                        <SuspenseReveal fallback={null}>
                            <CategoryHeaderActions params={props.params} />
                        </SuspenseReveal>
                    }
                    description={
                        <SuspenseReveal fallback={ <Skeleton variant="text" width={200} /> }>
                            <CategoryDescription params={props.params} />
                        </SuspenseReveal>
                    }
                    icon={
                        <SuspenseReveal fallback={ <InfoOutlinedIcon /> }>
                            <CategoryIcon params={props.params} />
                        </SuspenseReveal>
                    }
                    title={
                        <SuspenseReveal fallback={ <Skeleton variant="text" width={150} /> }>
                            <CategoryTitle params={props.params} />
                        </SuspenseReveal>
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

export const instant = true;
export const prefetch = 'partial';
