// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

import { ContentCreate } from '@app/admin/system/content/ContentCreate';
import { ContentList } from '@app/admin/system/content/ContentList';
import { createContent } from '@app/admin/system/content/ContentActions';
import { createEventScope } from '@app/admin/system/content/ContentScope';
import { generateEventMetadataFn } from '../../generateEventMetadataFn';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';

/**
 * The <EventWebsitePage> page lists the content pages that exist for this team's website, together
 * with the ability to create new pages. Navigation is enabled through the surrounding layout.
 */
export default async function EventWebsitePage(
    props: PageProps<'/admin/events/[event]/[team]/website'>)
{
    const { event, team } = await verifyAccessAndFetchPageInfo(props.params);
    if (!team.flagManagesContent)
        notFound();

    const pathPrefix = `/registration/${event.slug}/`;
    const scope = createEventScope(event.id, team.id);

    const createFn = createContent.bind(null, scope);

    return (
        <>
            <ContentList linkPrefix="./website/content/"
                         pathPrefix={pathPrefix} scope={scope} />

            <Divider sx={{ mt: 2, mb: 1 }} />
            <Typography variant="h6" sx={{
                marginTop: '8px !important',
                marginBottom: '-8px !important',
            }}>
                Create a new page
            </Typography>

            <ContentCreate createFn={createFn} linkPrefix="./website/content/"
                           pathPrefix={pathPrefix} />
        </>
    );
}

export const generateMetadata = generateEventMetadataFn('Website');
