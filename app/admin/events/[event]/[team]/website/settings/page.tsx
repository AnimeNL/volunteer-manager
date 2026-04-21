// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import Alert from '@mui/material/Alert';

import { generateEventMetadataFn } from '../../../generateEventMetadataFn';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';

/**
 * The <EventWebsiteSettingsPage> page allows settings relating to the website to be changed, such
 * as availability and timelines.
 */
export default async function EventWebsiteSettingsPage(
    props: PageProps<'/admin/events/[event]/[team]/website/settings'>)
{
    const { team } = await verifyAccessAndFetchPageInfo(props.params);
    if (!team.flagManagesContent)
        notFound();

    return (
        <Alert severity="error">
            This page has not been implemented yet.
        </Alert>
    );
}

export const generateMetadata = generateEventMetadataFn('Website settings');
