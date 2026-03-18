// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useContext, useMemo } from 'react';

import Card from '@mui/material/Card';
import ReadMoreIcon from '@mui/icons-material/ReadMore';

import type { CardTimeslot } from '../../components/CardTimeslotEntry';
import { CardTimeslotList } from '../../components/CardTimeslotList';
import { ErrorCard } from '../../components/ErrorCard';
import { HeaderButton } from '../../components/HeaderButton';
import { ScheduleContext } from '../../ScheduleContext';
import { SetTitle } from '../../components/SetTitle';
import { currentZonedDateTime } from '../../CurrentTime';

/**
 * Props accepted by the <LocationList> component.
 */
interface LocationListProps {
    /**
     * Unique ID of the area, as should be known in the schedule's program.
     */
    areaId: string;
}

/**
 * The <LocationList> component displays an overview of the locations part of a particular area. The
 * data is sourced from the schedule context, and will be dynamically updated with schedule changes.
 */
export function LocationList(props: LocationListProps) {
    const { schedule } = useContext(ScheduleContext);

    const [ now, locations ] = useMemo(() => {
        const now = currentZonedDateTime();
        if (!schedule || !schedule.program.areas.hasOwnProperty(props.areaId))
            return [ now, [ /* no locations */ ] ];

        const nowEpochSeconds = Math.round(now.epochMilliseconds / 1000);

        const area = schedule.program.areas[props.areaId];

        const locations = area.locations.map(locationId => {
            const location = schedule.program.locations[locationId];

            const active: CardTimeslot[] = [];
            const future: CardTimeslot[] = [];

            for (const timeslotId of location.timeslots) {
                const timeslot = schedule.program.timeslots[timeslotId];
                if (timeslot.end <= nowEpochSeconds)
                    continue;

                const activity = schedule.program.activities[timeslot.activity];
                const cardTimeslot: CardTimeslot = {
                    id: timeslot.id,
                    activityId: timeslot.activity,
                    start: timeslot.start,
                    end: timeslot.end,
                    title: activity.title,
                    favourite: !!schedule.favourites?.hasOwnProperty(timeslot.activity),
                    invisible: activity.invisible,
                };

                if (timeslot.start <= nowEpochSeconds)
                    active.push(cardTimeslot);
                else
                    future.push(cardTimeslot);
            }

            // Sort the `active` events based on when they end:
            active.sort((lhs, rhs) => lhs.end - rhs.end);

            // Sort the `future` events based on when they start:
            future.sort((lhs, rhs) => lhs.start - rhs.start);

            return {
                id: location.id,
                name: location.name,
                timeslots: [
                    ...active,
                    ...future.slice(
                        0, Math.max(0, schedule.config.activityListLimit - active.length)),
                ],
            };
        });

        // Sort the `locations` first by whether there are any remaining timeslots, then by their
        // name. This moves locations where events have finished for the festival to the bottom.
        locations.sort((lhs, rhs) => {
            if (!!lhs.timeslots.length !== !!rhs.timeslots.length)
                return !!lhs.timeslots.length ? -1 : 1;

            return lhs.name.localeCompare(rhs.name);
        });

        return [ now, locations ];

    }, [ props.areaId, schedule ]);

    if (!schedule)
        return undefined;

    if (!schedule.program.areas.hasOwnProperty(props.areaId)) {
        return (
            <ErrorCard title="This area does not exist!">
                The area you've tried to access does not exist.
            </ErrorCard>
        );
    }

    const prefix = `/schedule/${schedule.slug}`;

    return (
        <>
            <SetTitle title={schedule.program.areas[props.areaId].name} />
            { !locations.length &&
                <ErrorCard title="No locations could be found!">
                    The locations in this area have not been announced yet.
                </ErrorCard> }

            { Object.values(locations).map(location =>
                <Card key={location.id}>
                    <HeaderButton href={`${prefix}/locations/${location.id}`} title={location.name}
                                  icon={ <ReadMoreIcon color="primary" /> } />
                    <CardTimeslotList currentTime={now} prefix={prefix}
                                      timeslots={location.timeslots} />
                </Card> ) }
        </>
    );
}
