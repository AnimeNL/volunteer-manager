// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Fragment } from 'react';
import { notFound, redirect } from 'next/navigation';

import Divider from '@mui/material/Divider';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

import { Header } from '../../components/Header';
import { Page, SuspenseReveal } from '../../components/Page';
import { ScheduleList, ScheduleListRow } from '../../components/ScheduleList';
import { ScheduleListSkeleton } from '../../components/ScheduleListSkeleton';
import { SectionHeader } from '../../components/SectionHeader';
import { compareTimeslots, getLogicalDate, getTimeslotTiming } from '../../lib/programTime';
import { formatDate } from '@lib/Temporal';
import { getProgramLocationDetail } from '../../lib/data/programData';
import { getSchedulePath } from '../../lib/navigationTypes';
import { requireScheduleAccess } from '../../lib/getScheduleAccess';

/**
 * Streams the resolved location title into the page `<Header>`.
 */
async function LocationTitle(props: { params: Promise<{ event: string; id: string }> }) {
    const { event: eventSlug, id } = await props.params;
    const { event } = await requireScheduleAccess(eventSlug);
    const data = await getProgramLocationDetail(
        event.integrations?.anPlanFestivalId, id, event.timeZone);

    return data?.name ?? null;
}

/**
 * Streams the parent area name into the page `<Header>` description.
 */
async function LocationDescription(props: { params: Promise<{ event: string; id: string }> }) {
    const { event: eventSlug, id } = await props.params;
    const { event } = await requireScheduleAccess(eventSlug);
    const data = await getProgramLocationDetail(
        event.integrations?.anPlanFestivalId, id, event.timeZone);

    return data?.areaName ?? null;
}

/**
 * Authenticates the request behind `<Suspense>` and renders day-grouped events for the location.
 * Redirects directly to the event page when the location only hosts a single event.
 */
async function LocationScheduleContent(props: { params: Promise<{ event: string; id: string }> }) {
    const { event: eventSlug, id } = await props.params;
    const { currentTime, event } = await requireScheduleAccess(eventSlug);
    const data = await getProgramLocationDetail(
        event.integrations?.anPlanFestivalId, id, event.timeZone);
    if (!data)
        notFound();

    const [ firstRow ] = data.rows;
    if (firstRow && data.rows.every(row => row.activityId === firstRow.activityId))
        redirect(getSchedulePath(event.slug, `/events/${firstRow.activityId}`));

    const nowMs = currentTime.epochMilliseconds;
    const dayMap = new Map<string, {
        dateKey: string;
        events: {
            activityId: number;
            endMs: number;
            hidden: boolean;
            isPast: boolean;
            progress: number | undefined;
            startMs: number;
            state: 'active' | 'default' | 'past';
            time: string;
            timeslotId: number;
            title: string;
        }[];
        label: string;
    }>();

    for (const row of data.rows) {
        const startMs = row.start.epochMilliseconds;
        const endMs = row.end.epochMilliseconds;
        const { isPast, progress, state } = getTimeslotTiming(startMs, endMs, nowMs);

        const logicalDate = getLogicalDate(row.start);
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
            isPast,
            progress,
            startMs,
            state,
            time: `${formatDate(row.start, 'HH:mm')}–${formatDate(row.end, 'HH:mm')}`,
            timeslotId: row.timeslotId,
            title: row.title,
        });
    }

    const days = [ ...dayMap.values() ]
        .map(day => {
            day.events.sort(compareTimeslots);

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
                                    progress={programEvent.progress}
                                    state={programEvent.state}
                                    title={programEvent.title}
                                    trailing={programEvent.time} /> ) }
                        </ScheduleList>
                    </Stack>
                </Fragment>
            )) }
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
            <SuspenseReveal
                fallback={
                    <ScheduleListSkeleton
                        groups={[
                            { rows: [ 210, 175, 195 ], titleWidth: 72, trailingWidth: 72 },
                            { rows: [ 205, 165 ], titleWidth: 64, trailingWidth: 72 },
                        ]} />
                }>
                <LocationScheduleContent params={props.params} />
            </SuspenseReveal>
        </Page>
    );
}

export const instant = true;
export const prefetch = 'partial';
