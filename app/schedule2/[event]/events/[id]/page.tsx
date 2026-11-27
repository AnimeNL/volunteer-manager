// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

import { EventFavouriteButton } from './EventFavouriteButton';
import { EventTicketSalesSection } from './EventTicketSalesSection';
import { Header, HeaderAsyncSlot, HeaderTextSlot } from '../../components/Header';
import { Page, SuspenseReveal } from '../../components/Page';
import { ScheduleListRow } from '../../components/ScheduleList';
import { ScheduleListSkeleton } from '../../components/ScheduleListSkeleton';
import { ScheduleSection } from '../../components/ScheduleSection';
import { compareTimeslots, formatTimeRange, getTimeslotTiming } from '../../lib/programTime';
import { createScheduleMetadataFn } from '../../lib/generateScheduleMetadata';
import { getEventState } from '@lib/event';
import { getEventTicketSales } from '../../lib/data/ticketData';
import { getFavouritedActivityIds } from '../../lib/data/programData';
import { getSchedulePath } from '../../lib/navigationTypes';
import { readCachedSetting } from '@lib/Settings';
import { requireScheduleAccess } from '../../lib/getScheduleAccess';

import { kActivityType } from '@lib/database/Types';

/**
 * Resolves a program activity and its scheduled timeslots from `EventState`.
 */
async function loadEventDetail(params: Promise<{ event: string; id: string }>) {
    const { event: eventSlug, id } = await params;
    const activityId = Number(id);
    if (!Number.isInteger(activityId) || activityId <= 0)
        return undefined;

    const { event } = await requireScheduleAccess(eventSlug);
    const eventState = await getEventState(event);
    const activity = eventState?.program.getActivity(activityId);
    if (!eventState || !activity || activity.type !== kActivityType.Program)
        return undefined;

    const rawTimeslots = eventState.program.getTimeslotsForActivity(activityId);
    if (!rawTimeslots.length)
        return undefined;

    const locationNames = new Set<string>();
    const timeslots = rawTimeslots.map(slot => {
        const locationName = eventState.program.getLocation(slot.locationId)?.name ?? '';
        if (locationName)
            locationNames.add(locationName);

        return {
            endMs: slot.endMs,
            locationId: slot.locationId,
            locationName,
            startMs: slot.startMs,
            timeslotId: slot.id,
        };
    });

    const location = locationNames.size === 1
        ? [ ...locationNames ][0]
        : 'Multiple locations…';

    return {
        activityId,
        location,
        timeslots,
        title: activity.title,
    };
}

/**
 * Streams the volunteer's favourite toggle button into the page `<Header>` actions.
 */
async function EventFavouriteAction(props: { params: Promise<{ event: string; id: string }> }) {
    const { event: eventSlug } = await props.params;
    const [ { event, user }, data ] = await Promise.all([
        requireScheduleAccess(eventSlug),
        loadEventDetail(props.params),
    ]);
    if (!data)
        return null;

    const favouritedActivityIds = await getFavouritedActivityIds(event.id, user.id);

    return (
        <EventFavouriteButton
            activityId={data.activityId}
            eventSlug={event.slug}
            initialFavourited={favouritedActivityIds.has(data.activityId)} />
    );
}

/**
 * Authenticates the request behind `<Suspense>` and renders scheduled timeslots and ticket sales
 * for the event.
 */
async function EventContent(props: { params: Promise<{ event: string; id: string }> }) {
    const { event: eventSlug } = await props.params;
    const [ { access, currentTime, event }, data, showSales ] = await Promise.all([
        requireScheduleAccess(eventSlug),
        loadEventDetail(props.params),
        readCachedSetting('schedule-show-sales-information', /* fallback= */ false),
    ]);

    if (!data)
        notFound();

    const sales = showSales
        ? await getEventTicketSales(event, data.activityId, data.title)
        : [];
    const canViewTickets = access.can('event.tickets', 'read', { event: event.slug });

    const nowMs = currentTime.epochMilliseconds;
    const timeslots = data.timeslots
        .map(row => {
            const start = Temporal.Instant.fromEpochMilliseconds(row.startMs)
                .toZonedDateTimeISO(event.timeZone);
            const end = Temporal.Instant.fromEpochMilliseconds(row.endMs)
                .toZonedDateTimeISO(event.timeZone);
            const { isPast, progress, state } = getTimeslotTiming(row.startMs, row.endMs, nowMs);

            return {
                endMs: row.endMs,
                isPast,
                locationId: row.locationId,
                locationName: row.locationName,
                progress,
                startMs: row.startMs,
                state,
                time: formatTimeRange(start, end, { includeDay: true }),
                timeslotId: row.timeslotId,
            };
        })
        .sort((lhs, rhs) =>
            compareTimeslots(lhs, rhs) ||
            lhs.locationName.localeCompare(rhs.locationName));

    const allPast = timeslots.every(timeslot => timeslot.isPast);

    return (
        <Stack spacing={2} useFlexGap>
            <ScheduleSection muted={allPast} title="Timeslots">
                { timeslots.map(timeslot =>
                    <ScheduleListRow
                        key={timeslot.timeslotId}
                        href={getSchedulePath(event.slug, `/locations/${timeslot.locationId}`)}
                        progress={timeslot.progress}
                        state={timeslot.state}
                        title={timeslot.locationName}
                        trailing={timeslot.time} /> ) }
            </ScheduleSection>
            <EventTicketSalesSection
                activityId={data.activityId}
                canViewTickets={canViewTickets}
                eventSlug={event.slug}
                sales={sales} />
        </Stack>
    );
}

/**
 * Program event detail page displaying event details and scheduled timeslots.
 */
export default function ScheduleEventPage(props: PageProps<'/schedule2/[event]/events/[id]'>) {
    return (
        <Page
            header={
                <Header
                    actions={
                        <HeaderAsyncSlot
                            fallback={ <Skeleton variant="circular" width={40} height={40} /> }
                            resolve={() => EventFavouriteAction({ params: props.params })} />
                    }
                    description={
                        <HeaderTextSlot
                            resolve={async () =>
                                (await loadEventDetail(props.params))?.location ?? null}
                            width={112} />
                    }
                    icon={ <EventNoteOutlinedIcon /> }
                    title={
                        <HeaderTextSlot
                            resolve={async () =>
                                (await loadEventDetail(props.params))?.title ?? null}
                            width={160} />
                    } />
            }>
            <SuspenseReveal
                fallback={
                    <ScheduleListSkeleton
                        groups={[
                            { rows: [ 140, 120 ], titleWidth: 68, trailingWidth: 96 },
                        ]} />
                }>
                <EventContent params={props.params} />
            </SuspenseReveal>
        </Page>
    );
}

export const generateMetadata =
    createScheduleMetadataFn({ activity: 'id' }, 'Events', { event: 'event' });
export const instant = true;
export const prefetch = 'partial';
