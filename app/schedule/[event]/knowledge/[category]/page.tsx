// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import { HeaderSectionCard } from '../../components/HeaderSectionCard';
import { KnowledgeBaseIcon } from '@components/KnowledgeBaseIcon';
import { Markdown } from '@components/Markdown';
import { SetTitle } from '../../components/SetTitle';
import { generateScheduleMetadata, getTitleCache } from '../../lib/generateScheduleMetadataFn';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tContent, tContentCategories } from '@lib/database';

import { kContentType } from '@lib/database/Types';
import { kThemeImageVersion } from '@app/config';

/**
 * The <ScheduleKnowledgeCategoryPage> component displays a list of all questions within a given
 * category of the knowledge base. All questions will be alphabetically listed on this page.
 */
export default async function ScheduleKnowledgeCategoryPage(
    props: PageProps<'/schedule/[event]/knowledge/[category]'>)
{
    const params = await props.params;

    await requireAuthenticationContext({ check: 'event', event: params.event });

    const searchParams = await props.searchParams;

    const dbInstance = db;
    const category = await dbInstance.selectFrom(tContentCategories)
        .innerJoin(tContent)
            .on(tContent.contentType.equals(kContentType.FAQ))
                .and(tContent.contentCategoryId.equals(tContentCategories.categoryId))
                .and(tContent.revisionVisible.equals(/* true= */ 1))
        .where(tContentCategories.categoryId.equals(parseInt(params.category, 10)))
            .and(tContentCategories.categoryDeleted.isNull())
        .select({
            title: tContentCategories.categoryTitle,
            icon: tContentCategories.categoryIcon,
            description: tContentCategories.categoryDescription,

            questions: dbInstance.aggregateAsArray({
                id: tContent.contentPath,
                question: tContent.contentTitle,
                answer: tContent.content,
            }),
        })
        .groupBy(tContentCategories.categoryId)
        .executeSelectNoneOrOne();

    if (!category || !category.questions.length)
        notFound();

    category.questions.sort((lhs, rhs) => lhs.question.localeCompare(rhs.question));

    return (
        <>
            <SetTitle title={category.title} />
            <HeaderSectionCard>
                <Box sx={{
                    backgroundImage:
                        `url(/images/theme/knowledge-base-category.jpg?${kThemeImageVersion})`,
                    backgroundPosition: 'center',
                    backgroundSize: 'cover',
                    width: '100%',
                    aspectRatio: 3.5 }} />
            </HeaderSectionCard>
            <Card>
                <CardHeader avatar={ <KnowledgeBaseIcon variant={category.icon} /> }
                            title={category.title}
                            titleTypographyProps={{ variant: 'subtitle2' }}
                            subheader={category.description} />
            </Card>
            <Box sx={{ '& .MuiAccordionDetails-root': { paddingTop: 0 } }}>
                { category.questions.map(({ id, question, answer }) =>
                    <Accordion key={id} id={id} defaultExpanded={ searchParams.q === id }>
                        <AccordionSummary expandIcon={ <ExpandMoreIcon /> }>
                            {question}
                        </AccordionSummary>
                        <AccordionDetails>
                            <Markdown defaultVariant="body2">{answer}</Markdown>
                        </AccordionDetails>
                    </Accordion> )}
            </Box>
        </>
    );
}

export async function generateMetadata(props: PageProps<'/schedule/[event]/knowledge/[category]'>) {
    const cache = getTitleCache('knowledge-base');
    const category = (await props.params).category;

    let categoryName = cache.get(category);
    if (!categoryName) {
        categoryName = await db.selectFrom(tContentCategories)
            .where(tContentCategories.categoryId.equals(
                parseInt(category, /* radix= */ 10)))
                .and(tContentCategories.categoryDeleted.isNull())
            .selectOneColumn(tContentCategories.categoryTitle)
            .executeSelectNoneOrOne() ?? 'Unknown category';

        cache.set(category, categoryName);
    }

    return generateScheduleMetadata(props, [ categoryName!, 'Knowledge Base' ]);
}
