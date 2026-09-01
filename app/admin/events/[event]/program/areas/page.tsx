// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { AreaDataTable } from './AreaDataTable';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';

/**
 * The <ProgramAreasPage> component contains the areas that are part of the program of a particular
 * event, or rather, its location. Each area links through to a detailed page.
 */
export default async function ProgramAreasPage(
    props: PageProps<'/admin/events/[event]/program/areas'>)
{
    const { event } = await verifyAccessAndFetchPageInfo(props.params);
    return <AreaDataTable event={event.slug} />;
}

export const generateMetadata =
    createGenerateMetadataFn('Areas', 'Program', { event: 'event' });
