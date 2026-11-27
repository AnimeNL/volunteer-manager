// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import Stack from '@mui/material/Stack';

import { Header, HeaderTextSlot } from '../../components/Header';
import { Page, SuspenseReveal } from '../../components/Page';
import { ScheduleListRow } from '../../components/ScheduleList';
import { ScheduleListSkeleton } from '../../components/ScheduleListSkeleton';
import { ScheduleSection } from '../../components/ScheduleSection';
import { createScheduleMetadataFn } from '../../lib/generateScheduleMetadata';
import { formatDate } from '@lib/Temporal';
import { formatTimeRange, getLogicalDate, getTimeslotTiming } from '../../lib/programTime';
import { getEventState } from '@lib/event';
import { getFavouritedActivityIds } from '../../lib/data/programData';
import { getSchedulePath } from '../../lib/navigationTypes';
import { getTicketedActivityIds } from '../../lib/data/ticketData';
import { pluralize } from '../../lib/format';
import { readSetting } from '@lib/Settings';
import { requireScheduleAccess } from '../../lib/getScheduleAccess';

/**
 * Loads the resolved program area metadata for the requested route parameters.
 */
async function loadAreaHeader(params: Promise<{ area: string; event: string }>) {
    const { area, event: eventSlug } = await params;
    const areaId = Number(area);
    if (!Number.isInteger(areaId) || areaId <= 0)
        return undefined;

    const { event } = await requireScheduleAccess(eventSlug);
    const eventState = await getEventState(event);
    const areaRecord = eventState?.program.getArea(areaId);
    if (!eventState || !areaRecord)
        return undefined;

    const locations = eventState.program.getLocations(areaId, { programOnly: true });
    if (!locations.length)
        return undefined;

    return {
        locationCount: locations.length,
        name: areaRecord.name,
    };
}

/**
 * Authenticates the request behind `<Suspense>` and renders each location's conjoined event list.
 */
async function AreaLocationsContent(props: { params: Promise<{ area: string; event: string }> }) {
    const { area, event: eventSlug } = await props.params;
    const areaId = Number(area);
    if (!Number.isInteger(areaId) || areaId <= 0)
        notFound();

    const { currentTime, event, user } = await requireScheduleAccess(eventSlug);

    const [ eventState, favouritedActivityIds, listLimit, ticketedActivityIds ] = await Promise.all([
        getEventState(event),
        getFavouritedActivityIds(event.id, user.id),
        readSetting('schedule-activity-list-limit'),
        getTicketedActivityIds(event),
    ]);

    const areaRecord = eventState?.program.getArea(areaId);
    const programLocations = areaRecord
        ? eventState!.program.getLocations(areaId, { programOnly: true })
        : [];

    if (!eventState || !areaRecord || !programLocations.length)
        notFound();

    const maxEvents = listLimit ?? 5;
    const nowMs = currentTime.epochMilliseconds;
    const today = getLogicalDate(currentTime);

    const locations = programLocations
        .map(location => {
            const timeslots = eventState.program.getTimeslotsForLocation(
                location.id, { programOnly: true });

            const active = timeslots
                .filter(slot => slot.startMs <= nowMs && slot.endMs > nowMs)
                .sort((lhs, rhs) => lhs.endMs - rhs.endMs);
            const upcoming = timeslots
                .filter(slot => slot.startMs > nowMs)
                .sort((lhs, rhs) => lhs.startMs - rhs.startMs);

            const remainingSlots = Math.max(0, maxEvents - active.length);
            return {
                events: [ ...active, ...upcoming.slice(0, remainingSlots) ],
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
                        { location.events.map(slot => {
                            const activity = eventState.program.getActivity(slot.activityId);
                            if (!activity)
                                return null;

                            const start = Temporal.Instant.fromEpochMilliseconds(slot.startMs)
                                .toZonedDateTimeISO(event.timeZone);
                            const end = Temporal.Instant.fromEpochMilliseconds(slot.endMs)
                                .toZonedDateTimeISO(event.timeZone);
                            const timing = getTimeslotTiming(slot.startMs, slot.endMs, nowMs);

                            const sameDay = today.equals(getLogicalDate(start));
                            const trailing = timing.isActive
                                ? `until ${formatDate(end, 'HH:mm')}`
                                : formatTimeRange(start, end, { includeDay: !sameDay });

                            return (
                                <ScheduleListRow
                                    key={slot.id}
                                    favourite={favouritedActivityIds.has(slot.activityId)}
                                    hidden={!activity.visible}
                                    href={getSchedulePath(
                                        event.slug, `/events/${slot.activityId}`)}
                                    progress={timing.progress}
                                    state={timing.state}
                                    ticketed={ticketedActivityIds.has(slot.activityId)}
                                    title={activity.title}
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
                        <HeaderTextSlot
                            resolve={async () => {
                                const data = await loadAreaHeader(props.params);
                                return data
                                    ? `${pluralize(data.locationCount, 'location')} in this area`
                                    : null;
                            }}
                            width={140} />
                    }
                    icon={ <EventNoteOutlinedIcon /> }
                    title={
                        <HeaderTextSlot
                            resolve={async () => (await loadAreaHeader(props.params))?.name ?? null}
                            width={120} />
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

export const generateMetadata =
    createScheduleMetadataFn({ area: 'area' }, 'Events', { event: 'event' });
export const instant = true;
export const prefetch = 'partial';
