// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { LocationList } from './LocationList';
import { generateScheduleMetadata, getTitleCache } from '../../lib/generateScheduleMetadataFn';
import db, { tActivitiesAreas } from '@lib/database';

/**
 * The <ScheduleAreaPage> component displays an overview of the locations that are part of a given
 * area, together with information on what's currently happening within them. Authentication is
 * skipped as this page only consumes data already shared with the client.
 */
export default async function ScheduleAreaPage(props: PageProps<'/schedule/[event]/areas/[area]'>) {
    return <LocationList areaId={(await props.params).area} />;
}

export async function generateMetadata(props: PageProps<'/schedule/[event]/areas/[area]'>) {
    const cache = getTitleCache('areas');
    const area = (await props.params).area;

    let areaName = cache.get(area);
    if (!areaName) {
        areaName = await db.selectFrom(tActivitiesAreas)
            .where(tActivitiesAreas.areaId.equals(parseInt(area, /* radix= */ 10)))
                .and(tActivitiesAreas.areaDeleted.isNull())
            .selectOneColumn(
                tActivitiesAreas.areaDisplayName.valueWhenNull(tActivitiesAreas.areaName))
            .executeSelectNoneOrOne() ?? 'Unknown area';

        cache.set(area, areaName);
    }

    return generateScheduleMetadata(props, [ areaName! ]);
}
