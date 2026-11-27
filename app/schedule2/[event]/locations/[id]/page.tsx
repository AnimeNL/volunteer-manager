// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Fragment } from 'react';
import { notFound, redirect } from 'next/navigation';

import Divider from '@mui/material/Divider';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import Stack from '@mui/material/Stack';

import { Header, HeaderTextSlot } from '../../components/Header';
import { Page, SuspenseReveal } from '../../components/Page';
import { ScheduleListRow } from '../../components/ScheduleList';
import { ScheduleListSkeleton } from '../../components/ScheduleListSkeleton';
import { ScheduleSection } from '../../components/ScheduleSection';
import { compareTimeslots, formatTimeRange, getLogicalDate,
    getTimeslotTiming } from '../../lib/programTime';
import { createScheduleMetadataFn } from '../../lib/generateScheduleMetadata';
import { formatDate } from '@lib/Temporal';
import { getEventState } from '@lib/event';
import { getFavouritedActivityIds } from '../../lib/data/programData';
import { getSchedulePath } from '../../lib/navigationTypes';
import { getTicketedActivityIds } from '../../lib/data/ticketData';
import { requireScheduleAccess } from '../../lib/getScheduleAccess';

/**
 * Loads the resolved program location header metadata for the requested route parameters.
 */
async function loadLocationHeader(params: Promise<{ event: string; id: string }>) {
    const { event: eventSlug, id } = await params;
    const locationId = Number(id);
    if (!Number.isInteger(locationId) || locationId <= 0)
        return undefined;

    const { event } = await requireScheduleAccess(eventSlug);
    const eventState = await getEventState(event);
    const location = eventState?.program.getLocation(locationId);
    const area = location ? eventState?.program.getArea(location.areaId) : undefined;
    if (!eventState || !location || !area)
        return undefined;

    const timeslots = eventState.program.getTimeslotsForLocation(
        locationId, { programOnly: true });
    if (!timeslots.length)
        return undefined;

    return {
        areaName: area.name,
        name: location.name,
    };
}

/**
 * Authenticates the request behind `<Suspense>` and renders day-grouped events for the location.
 * Redirects directly to the event page when the location only hosts a single event.
 */
async function LocationScheduleContent(props: { params: Promise<{ event: string; id: string }> }) {
    const { event: eventSlug, id } = await props.params;
    const locationId = Number(id);
    if (!Number.isInteger(locationId) || locationId <= 0)
        notFound();

    const { currentTime, event, user } = await requireScheduleAccess(eventSlug);
    const [ eventState, favouritedActivityIds, ticketedActivityIds ] = await Promise.all([
        getEventState(event),
        getFavouritedActivityIds(event.id, user.id),
        getTicketedActivityIds(event),
    ]);

    const location = eventState?.program.getLocation(locationId);
    const timeslots = location
        ? eventState!.program.getTimeslotsForLocation(locationId, { programOnly: true })
        : [];
    if (!eventState || !location || !timeslots.length)
        notFound();

    const [ firstSlot ] = timeslots;
    if (firstSlot && timeslots.every(slot => slot.activityId === firstSlot.activityId))
        redirect(getSchedulePath(event.slug, `/events/${firstSlot.activityId}`));

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

    for (const slot of timeslots) {
        const activity = eventState.program.getActivity(slot.activityId);
        if (!activity)
            continue;

        const start = Temporal.Instant.fromEpochMilliseconds(slot.startMs)
            .toZonedDateTimeISO(event.timeZone);
        const end = Temporal.Instant.fromEpochMilliseconds(slot.endMs)
            .toZonedDateTimeISO(event.timeZone);
        const { isPast, progress, state } = getTimeslotTiming(slot.startMs, slot.endMs, nowMs);

        const logicalDate = getLogicalDate(start);
        const dateKey = logicalDate.toString();

        let day = dayMap.get(dateKey);
        if (!day) {
            day = { dateKey, events: [], label: formatDate(logicalDate, 'dddd') };
            dayMap.set(dateKey, day);
        }

        day.events.push({
            activityId: slot.activityId,
            endMs: slot.endMs,
            hidden: !activity.visible,
            isPast,
            progress,
            startMs: slot.startMs,
            state,
            time: formatTimeRange(start, end),
            timeslotId: slot.id,
            title: activity.title,
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
                    <ScheduleSection muted={day.isPast} title={day.label}>
                        { day.events.map(programEvent =>
                            <ScheduleListRow
                                key={programEvent.timeslotId}
                                favourite={favouritedActivityIds.has(programEvent.activityId)}
                                hidden={programEvent.hidden}
                                href={getSchedulePath(
                                    event.slug, `/events/${programEvent.activityId}`)}
                                progress={programEvent.progress}
                                state={programEvent.state}
                                ticketed={ticketedActivityIds.has(programEvent.activityId)}
                                title={programEvent.title}
                                trailing={programEvent.time} /> ) }
                    </ScheduleSection>
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
                        <HeaderTextSlot
                            resolve={async () =>
                                (await loadLocationHeader(props.params))?.areaName ?? null}
                            width={96} />
                    }
                    icon={ <PlaceOutlinedIcon /> }
                    title={
                        <HeaderTextSlot
                            resolve={async () =>
                                (await loadLocationHeader(props.params))?.name ?? null}
                            width={136} />
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

export const generateMetadata =
    createScheduleMetadataFn({ location: 'id' }, 'Events', { event: 'event' });
export const instant = true;
export const prefetch = 'partial';
