// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { LocationDataTable } from './LocationDataTable';
import { generateEventMetadataFn } from '../../generateEventMetadataFn';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';
import db, { tActivitiesAreas } from '@lib/database';

/**
 * The <ProgramLocationsPage> component contains the locations that are part of the program of a
 * particular event, or rather, its venue. Each location links through to a more detailed page.
 */
export default async function ProgramLocationsPage(
    props: PageProps<'/admin/events/[event]/program/locations'>)
{
    const { event } = await verifyAccessAndFetchPageInfo(props.params);

    const areas = await db.selectFrom(tActivitiesAreas)
        .where(tActivitiesAreas.areaFestivalId.equals(event.festivalId!))
            .and(tActivitiesAreas.areaDeleted.isNull())
        .select({
            value: tActivitiesAreas.areaId,
            label: tActivitiesAreas.areaDisplayName.valueWhenNull(tActivitiesAreas.areaName),
        })
        .executeSelectMany();

    return <LocationDataTable areas={areas} context={{ event: event.slug }} />;
}

export const generateMetadata = generateEventMetadataFn('Locations');
