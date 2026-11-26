// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Fragment, cache } from 'react';
import { notFound } from 'next/navigation';

import Divider from '@mui/material/Divider';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

import { Header } from '../../components/Header';
import { Page, SuspenseReveal } from '../../components/Page';
import { ScheduleList, ScheduleListRow } from '../../components/ScheduleList';
import { SectionHeader } from '../../components/SectionHeader';
import { formatDate } from '@lib/Temporal';
import { getSchedulePath } from '../../lib/navigationTypes';
import { requireScheduleAccess } from '../../lib/getScheduleAccess';
import db, { tActivities, tActivitiesAreas, tActivitiesLocations,
    tActivitiesTimeslots } from '@lib/database';

import { kActivityType } from '@lib/database/Types';

/**
 * Hour of the morning at which the logical festival day rolls over.
 */
const kLogicalDayChangeHour = 4;

/**
 * Request-cached loader fetching all scheduled program timeslots for `locationParam` in
 * `festivalId`.
 */
const loadLocationData = cache(async (festivalId: number | undefined, locationParam: string) => {
    const locationId = Number(locationParam);
    if (!festivalId || !Number.isInteger(locationId))
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
            .and(tActivitiesLocations.locationId.equals(locationId))
        .select({
            activityId: tActivities.activityId,
            areaName: tActivitiesAreas.areaDisplayName.valueWhenNull(tActivitiesAreas.areaName),
            end: tActivitiesTimeslots.timeslotEndTime,
            hidden: tActivities.activityVisible.equals(/* false= */ 0),
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
        areaName: rows[0].areaName,
        name: rows[0].locationName,
        rows,
    };
});

/**
 * Streams the resolved location title into the page `<Header>`.
 */
async function LocationTitle(props: { params: Promise<{ event: string; id: string }> }) {
    const { event: eventSlug, id } = await props.params;
    const { event } = await requireScheduleAccess(eventSlug);
    const data = await loadLocationData(event.integrations?.anPlanFestivalId, id);

    return data?.name ?? null;
}

/**
 * Streams the parent area name into the page `<Header>` description.
 */
async function LocationDescription(props: { params: Promise<{ event: string; id: string }> }) {
    const { event: eventSlug, id } = await props.params;
    const { event } = await requireScheduleAccess(eventSlug);
    const data = await loadLocationData(event.integrations?.anPlanFestivalId, id);

    return data?.areaName ?? null;
}

/**
 * Authenticates the request behind `<Suspense>` and renders day-grouped events for the location.
 */
async function LocationScheduleContent(props: { params: Promise<{ event: string; id: string }> }) {
    const { event: eventSlug, id } = await props.params;
    const { currentTime, event } = await requireScheduleAccess(eventSlug);
    const data = await loadLocationData(event.integrations?.anPlanFestivalId, id);
    if (!data)
        notFound();

    const nowMs = currentTime.epochMilliseconds;
    const dayMap = new Map<string, {
        dateKey: string;
        events: {
            activityId: number;
            endMs: number;
            hidden: boolean;
            isActive: boolean;
            isPast: boolean;
            startMs: number;
            time: string;
            timeslotId: number;
            title: string;
        }[];
        label: string;
    }>();

    for (const row of data.rows) {
        const start = row.start.withTimeZone(event.timeZone);
        const end = row.end.withTimeZone(event.timeZone);
        const startMs = row.start.epochMilliseconds;
        const endMs = row.end.epochMilliseconds;
        const isPast = endMs <= nowMs;

        const logicalDate = start.subtract({ hours: kLogicalDayChangeHour }).toPlainDate();
        const dateKey = logicalDate.toString();

        let day = dayMap.get(dateKey);
        if (!day) {
            day = { dateKey, events: [], label: formatDate(logicalDate, 'dddd') };
            dayMap.set(dateKey, day);
        }

        day.events.push({
            activityId: row.activityId,
            endMs,
            hidden: row.hidden,
            isActive: !isPast && startMs <= nowMs,
            isPast,
            startMs,
            time: `${formatDate(start, 'HH:mm')}–${formatDate(end, 'HH:mm')}`,
            timeslotId: row.timeslotId,
            title: row.title,
        });
    }

    const days = [ ...dayMap.values() ]
        .map(day => {
            day.events.sort((lhs, rhs) =>
                Number(lhs.isPast) - Number(rhs.isPast) ||
                lhs.startMs - rhs.startMs ||
                lhs.endMs - rhs.endMs);

            return { ...day, isPast: day.events.every(e => e.isPast) };
        })
        .sort((lhs, rhs) =>
            Number(lhs.isPast) - Number(rhs.isPast) ||
            lhs.dateKey.localeCompare(rhs.dateKey));

    return (
        <Stack spacing={2} useFlexGap>
            { days.map((day, index) => (
                <Fragment key={day.dateKey}>
                    { index > 0 && day.isPast && !days[index - 1].isPast && <Divider /> }
                    <Stack spacing={0.75} useFlexGap>
                        <SectionHeader muted={day.isPast} title={day.label} />
                        <ScheduleList muted={day.isPast}>
                            { day.events.map(programEvent =>
                                <ScheduleListRow
                                    key={programEvent.timeslotId}
                                    hidden={programEvent.hidden}
                                    href={getSchedulePath(
                                        event.slug, `/events/${programEvent.activityId}`)}
                                    progress={programEvent.isActive
                                        ? Math.round(((nowMs - programEvent.startMs) /
                                            (programEvent.endMs - programEvent.startMs)) * 100)
                                        : undefined}
                                    state={programEvent.isPast
                                        ? 'past'
                                        : (programEvent.isActive ? 'active' : 'default')}
                                    title={programEvent.title}
                                    trailing={programEvent.time}
                                    transitionTypes={[ 'nav-forward' ]} /> ) }
                        </ScheduleList>
                    </Stack>
                </Fragment>
            )) }
        </Stack>
    );
}

/**
 * Skeleton placeholder mirroring day-grouped events while location data is streaming.
 */
function LocationScheduleSkeleton() {
    const groups = [
        { rows: [ 210, 175, 195 ], titleWidth: 72 },
        { rows: [ 205, 165 ], titleWidth: 64 },
    ];

    return (
        <Stack spacing={2} useFlexGap>
            { groups.map((group, groupIndex) =>
                <Stack key={groupIndex} spacing={0.75} useFlexGap>
                    <SectionHeader
                        title={ <Skeleton variant="text" width={group.titleWidth} /> } />
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
 * Location detail page listing scheduled program events grouped by festival day.
 */
export default function ScheduleLocationPage(
    props: PageProps<'/schedule2/[event]/locations/[id]'>)
{
    return (
        <Page
            header={
                <Header
                    description={
                        <SuspenseReveal fallback={ <Skeleton variant="text" width={96} /> }>
                            <LocationDescription params={props.params} />
                        </SuspenseReveal>
                    }
                    icon={ <PlaceOutlinedIcon /> }
                    title={
                        <SuspenseReveal fallback={ <Skeleton variant="text" width={136} /> }>
                            <LocationTitle params={props.params} />
                        </SuspenseReveal>
                    } />
            }>
            <SuspenseReveal fallback={ <LocationScheduleSkeleton /> }>
                <LocationScheduleContent params={props.params} />
            </SuspenseReveal>
        </Page>
    );
}

export const instant = true;
export const prefetch = 'partial';
