// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import { ActivityDataTable } from './ActivityDataTable';
import { generateEventMetadataFn } from '../../generateEventMetadataFn';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';
import db, { tActivitiesLocations } from '@lib/database';

/**
 * The <ProgramActivitiesPage> component contains the activities that are part of the program of a
 * particular event. Each activity can link through to a detail page.
 */
export default async function ProgramActivitiesPage(
    props: PageProps<'/admin/events/[event]/program/activities'>)
{
    const { event } = await verifyAccessAndFetchPageInfo(props.params);
    if (!event.festivalId)
        notFound();

    const locations = await db.selectFrom(tActivitiesLocations)
        .where(tActivitiesLocations.locationFestivalId.equals(event.festivalId))
            .and(tActivitiesLocations.locationDeleted.isNull())
        .select({
            value: tActivitiesLocations.locationId,
            label: tActivitiesLocations.locationDisplayName.valueWhenNull(
                tActivitiesLocations.locationName),
        })
        .orderBy('label', 'asc')
        .executeSelectMany();

    return <ActivityDataTable event={event.slug} locations={locations} />;
}

export const generateMetadata = generateEventMetadataFn('Activities');
