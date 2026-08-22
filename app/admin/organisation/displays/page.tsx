// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { DisplayTableEventOption, DisplayTableLocationOption } from './DisplaysTable';
import { DisplaysTable } from './DisplaysTable';
import { createGenerateMetadataFn } from '../../lib/generatePageMetadata';
import { requireAuthentication } from '@lib/requireAuthentication';
import db, { tEvents, tActivitiesLocations } from '@lib/database';

/**
 * The <DisplaysPage> component hosts a data table that shows the physical displays that have
 * recently checked in, and allows them to be provisioned and configured.
 */
export default async function DisplaysPage() {
    await requireAuthentication('organisation.displays');

    const events: DisplayTableEventOption[] = await db.selectFrom(tEvents)
        .where(tEvents.eventFestivalId.isNotNull())
        .select({
            value: tEvents.eventId,
            label: tEvents.eventShortName,
        })
        .orderBy(tEvents.eventStartTime, 'desc')
        .executeSelectMany();

    const locations: DisplayTableLocationOption[] = await db.selectFrom(tActivitiesLocations)
        .innerJoin(tEvents)
            .on(tEvents.eventFestivalId.equals(tActivitiesLocations.locationFestivalId))
        .where(tActivitiesLocations.locationDeleted.isNull())
        .select({
            value: tActivitiesLocations.locationId,
            label: tActivitiesLocations.locationDisplayName.valueWhenNull(
                tActivitiesLocations.locationName),

            // Used for filtering the available locations:
            eventId: tEvents.eventId,
        })
        .orderBy('label', 'asc')
        .executeSelectMany();

    return <DisplaysTable events={events} locations={locations} />;
}

export const generateMetadata = createGenerateMetadataFn('Displays', 'Organisation');
