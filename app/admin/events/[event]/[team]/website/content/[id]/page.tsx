// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import Grid from '@mui/material/Grid';

import { ContentEditor } from '@app/admin/content/ContentEditor';
import { createEventScope } from '@app/admin/content/ContentScope';
import { generateEventMetadataFn } from '../../../../generateEventMetadataFn';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';
import { BackButtonGrid } from '@app/admin/components/BackButtonGrid';

/**
 * The <EventWebsiteContentPage> page enables the content on an individual page to be updated as
 * desired. The common content editing framework is used for this feature.
 */
export default async function EventWebsiteContentPage(
    props: PageProps<'/admin/events/[event]/[team]/website/content/[id]'>)
{
    const { event, team } = await verifyAccessAndFetchPageInfo(props.params);
    if (!team.flagManagesContent)
        notFound();

    const params = await props.params;
    const pathPrefix = `/registration/${event.slug}/`;
    const scope = createEventScope(event.id, team.id);

    return (
        <Grid container>
            <BackButtonGrid href={`/admin/events/${event.slug}/${team.slug}/website`}>
                Back to pages
            </BackButtonGrid>
            <ContentEditor contentId={parseInt(params.id, 10)} pathPrefix={pathPrefix} noSections
                           scope={scope} />
        </Grid>
    );
}

export const generateMetadata = generateEventMetadataFn('Website content');
