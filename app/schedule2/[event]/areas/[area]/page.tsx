// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

import { Header } from '../../components/Header';
import { Page, SuspenseReveal } from '../../components/Page';
import { ScheduleListRow } from '../../components/ScheduleList';
import { ScheduleListSkeleton } from '../../components/ScheduleListSkeleton';
import { ScheduleSection } from '../../components/ScheduleSection';
import { createScheduleMetadataFn } from '../../lib/generateScheduleMetadata';
import { formatDate } from '@lib/Temporal';
import { formatTimeRange, getLogicalDate, getTimeslotTiming } from '../../lib/programTime';
import { getProgramAreaDetail } from '../../lib/data/programData';
import { getSchedulePath } from '../../lib/navigationTypes';
import { pluralize } from '../../lib/format';
import { readSetting } from '@lib/Settings';
import { requireScheduleAccess } from '../../lib/getScheduleAccess';

/**
 * Streams the resolved area title into the page `<Header>`.
 */
async function AreaTitle(props: { params: Promise<{ area: string; event: string }> }) {
    const { area, event: eventSlug } = await props.params;
    const { event } = await requireScheduleAccess(eventSlug);
    const data = await getProgramAreaDetail(
        event.integrations?.anPlanFestivalId, area, event.timeZone);

    return data?.name ?? null;
}

/**
 * Streams the resolved area description into the page `<Header>`.
 */
async function AreaDescription(props: { params: Promise<{ area: string; event: string }> }) {
    const { area, event: eventSlug } = await props.params;
    const { event } = await requireScheduleAccess(eventSlug);
    const data = await getProgramAreaDetail(
        event.integrations?.anPlanFestivalId, area, event.timeZone);
    if (!data)
        return null;

    return `${pluralize(data.locationCount, 'location')} in this area`;
}

/**
 * Authenticates the request behind `<Suspense>` and renders each location's conjoined event list.
 */
async function AreaLocationsContent(props: { params: Promise<{ area: string; event: string }> }) {
    const { area, event: eventSlug } = await props.params;
    const { currentTime, event } = await requireScheduleAccess(eventSlug);

    const [ data, listLimit ] = await Promise.all([
        getProgramAreaDetail(event.integrations?.anPlanFestivalId, area, event.timeZone),
        readSetting('schedule-activity-list-limit'),
    ]);

    if (!data)
        notFound();

    type TimeslotRow = typeof data.rows[number];

    const maxEvents = listLimit ?? 5;
    const nowMs = currentTime.epochMilliseconds;
    const today = getLogicalDate(currentTime);

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
                    <ScheduleSection
                        key={location.id}
                        actionLabel="Full schedule"
                        href={getSchedulePath(event.slug, `/locations/${location.id}`)}
                        muted={isEmpty}
                        title={location.name}>
                        { isEmpty &&
                            <ScheduleListRow title="No upcoming events" /> }
                        { location.events.map(row => {
                            const timing = getTimeslotTiming(
                                row.start.epochMilliseconds, row.end.epochMilliseconds, nowMs);

                            const sameDay = today.equals(getLogicalDate(row.start));
                            const trailing = timing.isActive
                                ? `until ${formatDate(row.end, 'HH:mm')}`
                                : formatTimeRange(row.start, row.end, { includeDay: !sameDay });

                            return (
                                <ScheduleListRow
                                    key={row.timeslotId}
                                    hidden={row.hidden}
                                    href={getSchedulePath(
                                        event.slug, `/events/${row.activityId}`)}
                                    progress={timing.progress}
                                    state={timing.state}
                                    title={row.title}
                                    trailing={trailing} />
                            );
                        }) }
                    </ScheduleSection>
                );
            }) }
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
            <SuspenseReveal
                fallback={
                    <ScheduleListSkeleton
                        groups={[
                            { rows: [ 150, 140 ], titleWidth: 84, trailingWidth: 72 },
                            { rows: [ 130, 125 ], titleWidth: 112, trailingWidth: 72 },
                            { rows: [ 180, 145, 220 ], titleWidth: 76, trailingWidth: 72 },
                        ]} />
                }>
                <AreaLocationsContent params={props.params} />
            </SuspenseReveal>
        </Page>
    );
}

export const generateMetadata = createScheduleMetadataFn({ area: 'area' }, 'Events', { event: 'event' });
export const instant = true;
export const prefetch = 'partial';
