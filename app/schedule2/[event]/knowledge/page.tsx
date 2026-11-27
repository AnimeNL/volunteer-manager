// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Grid from '@mui/material/Grid';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Skeleton from '@mui/material/Skeleton';

import { EmptyStateCard } from '../components/EmptyStateCard';
import { Header } from '../components/Header';
import { KnowledgeCategoryGrid } from './KnowledgeCategoryGrid';
import { Page, SuspenseReveal } from '../components/Page';
import { createScheduleMetadataFn } from '../lib/generateScheduleMetadata';
import { getKnowledgeBaseCategories } from '../lib/data/knowledgeData';
import { requireScheduleAccess } from '../lib/getScheduleAccess';

/**
 * Authenticates the request behind `<Suspense>` and renders the Bento Grid of visible Knowledge
 * Base categories.
 */
async function KnowledgeCategoriesContent(props: { params: Promise<{ event: string }> }) {
    const { event: eventSlug } = await props.params;
    const { access, event, user } = await requireScheduleAccess(eventSlug);

    const hasUnrestrictedAccess = access.can('event.knowledge', { event: event.slug });
    const categories = await getKnowledgeBaseCategories(event.id, user.id, hasUnrestrictedAccess);

    if (!categories.length) {
        return (
            <EmptyStateCard
                description="The knowledge base for this event is not available yet." />
        );
    }

    return <KnowledgeCategoryGrid categories={categories} eventSlug={event.slug} />;
}

/**
 * Skeleton placeholder mirroring the responsive Bento Grid while categories are streaming.
 */
function KnowledgeCategoriesSkeleton() {
    return (
        <Grid container spacing={1.25}>
            { [ 0, 1, 2, 3 ].map(index =>
                <Grid key={index} size={{ xs: 12, sm: 6 }}>
                    <Skeleton variant="rounded" height={156} />
                </Grid> ) }
        </Grid>
    );
}

/**
 * Knowledge Base index page for the schedule portal.
 */
export default function ScheduleKnowledgePage(props: PageProps<'/schedule2/[event]/knowledge'>) {
    return (
        <Page
            header={
                <Header
                    description="Frequently asked questions and reference guides."
                    icon={ <InfoOutlinedIcon /> }
                    title="Knowledge base" />
            }>
            <SuspenseReveal fallback={ <KnowledgeCategoriesSkeleton /> }>
                <KnowledgeCategoriesContent params={props.params} />
            </SuspenseReveal>
        </Page>
    );
}

export const generateMetadata = createScheduleMetadataFn('Knowledge base', { event: 'event' });
export const instant = true;
export const prefetch = 'partial';
