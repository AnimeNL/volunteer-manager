// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { cache } from 'react';
import { notFound } from 'next/navigation';

import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

import { Header } from '../../components/Header';
import { Page, SuspenseReveal } from '../../components/Page';
import { ScheduleList, ScheduleListRow } from '../../components/ScheduleList';
import { SectionHeader } from '../../components/SectionHeader';
import { formatDate } from '@lib/Temporal';
import { getSchedulePath } from '../../lib/navigationTypes';
import { readSetting } from '@lib/Settings';
import { requireScheduleAccess } from '../../lib/getScheduleAccess';
import db, { tActivities, tActivitiesAreas, tActivitiesLocations,
    tActivitiesTimeslots } from '@lib/database';

import { kActivityType } from '@lib/database/Types';

/**
 * Hour of the morning at which the logical festival day rolls over.
 */
const kLogicalDayChangeHour = 4;

/**
 * Request-cached loader fetching all scheduled program timeslots for `areaParam` in `festivalId`.
 */
const loadAreaData = cache(async (festivalId: number | undefined, areaParam: string) => {
    const areaId = Number(areaParam);
    if (!festivalId || !Number.isInteger(areaId))
        return undefined;

    const rows = await db.selectFrom(tActivities)
        .innerJoin(tActivitiesTimeslots)
            .on(tActivitiesTimeslots.activityId.equals(tActivities.activityId))
                .and(tActivitiesTimeslots.timeslotDeleted.isNull())
        .innerJoin(tActivitiesLocations)
            .on(tActivitiesLocations.locationId.equals(tActivitiesTimeslots.timeslotLocationId))
                .and(tActivitiesLocations.locationDeleted.isNull())
        .innerJoin(tActivitiesAreas)
            .on(tActivitiesAreas.areaId.equals(tActivitiesLocations.locationAreaId))
                .and(tActivitiesAreas.areaDeleted.isNull())
        .where(tActivities.activityFestivalId.equals(festivalId))
            .and(tActivities.activityType.equals(kActivityType.Program))
            .and(tActivities.activityDeleted.isNull())
            .and(tActivitiesAreas.areaId.equals(areaId))
        .select({
            activityId: tActivities.activityId,
            areaName: tActivitiesAreas.areaDisplayName.valueWhenNull(tActivitiesAreas.areaName),
            end: tActivitiesTimeslots.timeslotEndTime,
            hidden: tActivities.activityVisible.equals(/* false= */ 0),
            locationId: tActivitiesLocations.locationId,
            locationName: tActivitiesLocations.locationDisplayName.valueWhenNull(
                tActivitiesLocations.locationName),
            start: tActivitiesTimeslots.timeslotStartTime,
            timeslotId: tActivitiesTimeslots.timeslotId,
            title: tActivities.activityTitle,
        })
        .executeSelectMany();

    if (!rows.length)
        return undefined;

    return {
        locationCount: new Set(rows.map(row => row.locationId)).size,
        name: rows[0].areaName,
        rows,
    };
});

/**
 * Streams the resolved area title into the page `<Header>`.
 */
async function AreaTitle(props: { params: Promise<{ area: string; event: string }> }) {
    const { area, event: eventSlug } = await props.params;
    const { event } = await requireScheduleAccess(eventSlug);
    const data = await loadAreaData(event.integrations?.anPlanFestivalId, area);

    return data?.name ?? null;
}

/**
 * Streams the resolved area description into the page `<Header>`.
 */
async function AreaDescription(props: { params: Promise<{ area: string; event: string }> }) {
    const { area, event: eventSlug } = await props.params;
    const { event } = await requireScheduleAccess(eventSlug);
    const data = await loadAreaData(event.integrations?.anPlanFestivalId, area);
    if (!data)
        return null;

    const label = data.locationCount === 1 ? 'location' : 'locations';
    return `${data.locationCount} ${label} in this area`;
}

/**
 * Authenticates the request behind `<Suspense>` and renders each location's conjoined event list.
 */
async function AreaLocationsContent(props: { params: Promise<{ area: string; event: string }> }) {
    const { area, event: eventSlug } = await props.params;
    const { currentTime, event } = await requireScheduleAccess(eventSlug);

    const [ data, listLimit ] = await Promise.all([
        loadAreaData(event.integrations?.anPlanFestivalId, area),
        readSetting('schedule-activity-list-limit'),
    ]);

    if (!data)
        notFound();

    type TimeslotRow = typeof data.rows[number];

    const maxEvents = listLimit ?? 5;
    const nowMs = currentTime.epochMilliseconds;
    const today = currentTime.subtract({ hours: kLogicalDayChangeHour }).toPlainDate();

    const locationMap = new Map<
        number, { active: TimeslotRow[]; id: number; name: string; upcoming: TimeslotRow[] }>();

    for (const row of data.rows) {
        let location = locationMap.get(row.locationId);
        if (!location) {
            location = { active: [], id: row.locationId, name: row.locationName, upcoming: [] };
            locationMap.set(row.locationId, location);
        }

        if (row.end.epochMilliseconds <= nowMs)
            continue;

        if (row.start.epochMilliseconds <= nowMs)
            location.active.push(row);
        else
            location.upcoming.push(row);
    }

    const locations = [ ...locationMap.values() ]
        .map(location => {
            location.active.sort((lhs, rhs) =>
                lhs.end.epochMilliseconds - rhs.end.epochMilliseconds);
            location.upcoming.sort((lhs, rhs) =>
                lhs.start.epochMilliseconds - rhs.start.epochMilliseconds);

            const remainingSlots = Math.max(0, maxEvents - location.active.length);
            return {
                events: [ ...location.active, ...location.upcoming.slice(0, remainingSlots) ],
                id: location.id,
                name: location.name,
            };
        })
        .sort((lhs, rhs) =>
            Number(!lhs.events.length) - Number(!rhs.events.length) ||
            lhs.name.localeCompare(rhs.name));

    return (
        <Stack spacing={2} useFlexGap>
            { locations.map(location => {
                const isEmpty = !location.events.length;

                return (
                    <Stack key={location.id} spacing={0.75} useFlexGap>
                        <SectionHeader
                            actionLabel="Full schedule"
                            href={getSchedulePath(event.slug, `/locations/${location.id}`)}
                            muted={isEmpty}
                            title={location.name}
                            transitionTypes={[ 'nav-forward' ]} />
                        <ScheduleList muted={isEmpty}>
                            { isEmpty &&
                                <ScheduleListRow title="No upcoming events" /> }
                            { location.events.map(row => {
                                const start = row.start.withTimeZone(event.timeZone);
                                const end = row.end.withTimeZone(event.timeZone);
                                const startMs = row.start.epochMilliseconds;
                                const endMs = row.end.epochMilliseconds;
                                const isActive = startMs <= nowMs;

                                const sameDay = today.equals(
                                    start.subtract({ hours: kLogicalDayChangeHour }).toPlainDate());

                                const trailing = isActive
                                    ? `until ${formatDate(end, 'HH:mm')}`
                                    : `${formatDate(start, sameDay ? 'HH:mm' : 'ddd, HH:mm')}` +
                                      `–${formatDate(end, 'HH:mm')}`;

                                return (
                                    <ScheduleListRow
                                        key={row.timeslotId}
                                        hidden={row.hidden}
                                        href={getSchedulePath(
                                            event.slug, `/events/${row.activityId}`)}
                                        progress={isActive
                                            ? Math.round(((nowMs - startMs) / (endMs - startMs))
                                                * 100)
                                            : undefined}
                                        state={isActive ? 'active' : 'default'}
                                        title={row.title}
                                        trailing={trailing}
                                        transitionTypes={[ 'nav-forward' ]} />
                                );
                            }) }
                        </ScheduleList>
                    </Stack>
                );
            }) }
        </Stack>
    );
}

/**
 * Skeleton placeholder mirroring the location groups while area data is streaming.
 */
function AreaLocationsSkeleton() {
    const groups = [
        { rows: [ 150, 140 ], titleWidth: 84 },
        { rows: [ 130, 125 ], titleWidth: 112 },
        { rows: [ 180, 145, 220 ], titleWidth: 76 },
    ];

    return (
        <Stack spacing={2} useFlexGap>
            { groups.map((group, groupIndex) =>
                <Stack key={groupIndex} spacing={0.75} useFlexGap>
                    <SectionHeader title={ <Skeleton variant="text" width={group.titleWidth} /> } />
                    <ScheduleList>
                        { group.rows.map((rowWidth, rowIndex) =>
                            <ScheduleListRow
                                key={rowIndex}
                                title={ <Skeleton variant="text" width={rowWidth} /> }
                                trailing={ <Skeleton variant="text" width={72} /> } /> ) }
                    </ScheduleList>
                </Stack> ) }
        </Stack>
    );
}

/**
 * Area detail page listing each location in the area and its active and upcoming program events.
 */
export default function ScheduleAreaPage(props: PageProps<'/schedule2/[event]/areas/[area]'>) {
    return (
        <Page
            header={
                <Header
                    description={
                        <SuspenseReveal fallback={ <Skeleton variant="text" width={140} /> }>
                            <AreaDescription params={props.params} />
                        </SuspenseReveal>
                    }
                    icon={ <EventNoteOutlinedIcon /> }
                    title={
                        <SuspenseReveal fallback={ <Skeleton variant="text" width={120} /> }>
                            <AreaTitle params={props.params} />
                        </SuspenseReveal>
                    } />
            }>
            <SuspenseReveal fallback={ <AreaLocationsSkeleton /> }>
                <AreaLocationsContent params={props.params} />
            </SuspenseReveal>
        </Page>
    );
}

export const instant = true;
export const prefetch = 'partial';
