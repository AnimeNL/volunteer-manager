// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import { ContentEditor } from '@app/admin/content/ContentEditor';
import { createKnowledgeBaseScope } from '@app/admin/content/ContentScope';
import { generateEventMetadataFn } from '../../../generateEventMetadataFn';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';
import db, { tContentCategories } from '@lib/database';

/**
 * This page displays an individual FAQ entry, which allows the volunteer to change both the
 * question and the answer to the question. A rich text editing component is made available.
 */
export default async function EventFaqEntryPage(
    props: PageProps<'/admin/events/[event]/[team]/knowledge/[id]'>)
{
    const { event, team } = await verifyAccessAndFetchPageInfo(props.params);
    if (!team.flagManagesFaq)
        notFound();

    const params = await props.params;

    // Select the categories that questions can be associated with.
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

    return (
        <ContentEditor contentId={parseInt(params.id, /* radix= */ 10)} pathHidden scope={scope}
                       title="Knowledge base" subtitle={event.shortName} categories={categories} />
    );
}

export const generateMetadata = generateEventMetadataFn('Knowledge base');
