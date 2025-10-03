// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import type { NextPageParams } from '@lib/NextRouterParams';
import { ContentEditor } from '@app/admin/content/ContentEditor';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createEventScope } from '@app/admin/content/ContentScope';
import { generateEventMetadataFn } from '../../../generateEventMetadataFn';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';

/**
 * The <EventContentEntryPage> page displays an individual piece of content that can be edited by
 * the volunteer. The <ContentEditor> component takes care of the actual behaviour.
 */
export default async function EventContentEntryPage(props: NextPageParams<'event' | 'team' | 'id'>)
{
    const { event, team } = await verifyAccessAndFetchPageInfo(props.params);
    if (!team.flagManagesContent)
        notFound();

    const params = await props.params;
    const pathPrefix = `/registration/${event.slug}/`;
    const scope = createEventScope(event.id, team.id);

    return (
        <ContentEditor contentId={parseInt(params.id, 10)} pathPrefix={pathPrefix} scope={scope}
                       title="Page editor" subtitle={team._environment}>
            <SectionIntroduction>
                You are editing content on <strong>{team._environment}</strong>, any changes that
                you save will be published immediately.
            </SectionIntroduction>
        </ContentEditor>
    );
}

export const generateMetadata = generateEventMetadataFn('Content');
