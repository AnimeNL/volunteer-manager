// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import Box from '@mui/material/Box';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

import { EventFavouriteButton } from './EventFavouriteButton';
import { Header } from '../../components/Header';
import { Page, SuspenseReveal } from '../../components/Page';
import { ScheduleList, ScheduleListRow } from '../../components/ScheduleList';
import { ScheduleListSkeleton } from '../../components/ScheduleListSkeleton';
import { SectionHeader } from '../../components/SectionHeader';
import { compareTimeslots, formatEuroPrice, getTimeslotTiming } from '../../lib/programTime';
import { formatDate } from '@lib/Temporal';
import { getEventTicketSales } from '../../lib/data/ticketData';
import { getProgramEventDetail } from '../../lib/data/programData';
import { getSchedulePath } from '../../lib/navigationTypes';
import { readCachedSetting } from '@lib/Settings';
import { requireScheduleAccess } from '../../lib/getScheduleAccess';
import db, { tUsersEventsFavourites } from '@lib/database';

/**
 * Streams the resolved program event title into the page `<Header>`.
 */
async function EventTitle(props: { params: Promise<{ event: string; id: string }> }) {
    const { event: eventSlug, id } = await props.params;
    const { event } = await requireScheduleAccess(eventSlug);
    const data = await getProgramEventDetail(
        event.integrations?.anPlanFestivalId, id, event.timeZone);

    return data?.title ?? null;
}

/**
 * Streams the resolved event location summary into the page `<Header>` description.
 */
async function EventDescription(props: { params: Promise<{ event: string; id: string }> }) {
    const { event: eventSlug, id } = await props.params;
    const { event } = await requireScheduleAccess(eventSlug);
    const data = await getProgramEventDetail(
        event.integrations?.anPlanFestivalId, id, event.timeZone);

    return data?.location ?? null;
}

/**
 * Streams the volunteer's favourite toggle button into the page `<Header>` actions.
 */
async function EventFavouriteAction(props: { params: Promise<{ event: string; id: string }> }) {
    const { event: eventSlug, id } = await props.params;
    const { event, user } = await requireScheduleAccess(eventSlug);
    const data = await getProgramEventDetail(
        event.integrations?.anPlanFestivalId, id, event.timeZone);
    if (!data)
        return null;

    const favourited = await db.selectFrom(tUsersEventsFavourites)
        .where(tUsersEventsFavourites.userId.equals(user.id))
            .and(tUsersEventsFavourites.eventId.equals(event.id))
            .and(tUsersEventsFavourites.activityId.equals(data.activityId))
        .selectCountAll()
        .executeSelectOne() > 0;

    return (
        <EventFavouriteButton
            activityId={data.activityId}
            eventSlug={event.slug}
            initialFavourited={favourited} />
    );
}

/**
 * Authenticates the request behind `<Suspense>` and renders scheduled timeslots and ticket sales
 * for the event.
 */
async function EventContent(props: { params: Promise<{ event: string; id: string }> }) {
    const { event: eventSlug, id } = await props.params;
    const { access, currentTime, event } = await requireScheduleAccess(eventSlug);

    const [ data, showSales ] = await Promise.all([
        getProgramEventDetail(event.integrations?.anPlanFestivalId, id, event.timeZone),
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
            const startMs = row.start.epochMilliseconds;
            const endMs = row.end.epochMilliseconds;
            const { isPast, progress, state } = getTimeslotTiming(startMs, endMs, nowMs);

            return {
                endMs,
                isPast,
                locationId: row.locationId,
                locationName: row.locationName,
                progress,
                startMs,
                state,
                time: `${formatDate(row.start, 'ddd, HH:mm')}–${formatDate(row.end, 'HH:mm')}`,
                timeslotId: row.timeslotId,
            };
        })
        .sort((lhs, rhs) =>
            compareTimeslots(lhs, rhs) ||
            lhs.locationName.localeCompare(rhs.locationName));

    const allPast = timeslots.every(timeslot => timeslot.isPast);

    return (
        <Stack spacing={2} useFlexGap>
            <Stack spacing={0.75} useFlexGap>
                <SectionHeader muted={allPast} title="Timeslots" />
                <ScheduleList muted={allPast}>
                    { timeslots.map(timeslot =>
                        <ScheduleListRow
                            key={timeslot.timeslotId}
                            href={getSchedulePath(event.slug, `/locations/${timeslot.locationId}`)}
                            progress={timeslot.progress}
                            state={timeslot.state}
                            title={timeslot.locationName}
                            trailing={timeslot.time} /> ) }
                </ScheduleList>
            </Stack>
            { sales.length > 0 &&
                <Stack spacing={0.75} useFlexGap>
                    <SectionHeader title="Tickets sold" />
                    <ScheduleList>
                        { sales.map(entry => {
                            const isSoldOut = entry.limit !== undefined &&
                                entry.sold >= entry.limit;
                            const progress = entry.limit !== undefined
                                ? Math.min(100, Math.round((entry.sold / entry.limit) * 100))
                                : undefined;
                            const progressColor = isSoldOut
                                ? 'error'
                                : ((progress ?? 0) < 75 ? 'success' : 'warning');
                            const price = entry.price !== undefined
                                ? ` · ${formatEuroPrice(entry.price)}`
                                : '';

                            const trailing = entry.limit !== undefined ? (
                                <>
                                    <Box
                                        component="span"
                                        sx={{
                                            color: isSoldOut ? 'error.main' : 'text.primary',
                                            fontWeight: isSoldOut ? 600 : 500,
                                        }}>
                                        {entry.sold}
                                    </Box>
                                    {` / ${entry.limit}${price}`}
                                </>
                            ) : (
                                <>
                                    <Box
                                        component="span"
                                        sx={{ color: 'text.primary', fontWeight: 500 }}>
                                        {entry.sold}
                                    </Box>
                                    {` sold${price}`}
                                </>
                            );

                            const href = canViewTickets
                                ? getSchedulePath(
                                    event.slug, `/events/${data.activityId}/tickets/${entry.id}`)
                                : undefined;

                            return (
                                <ScheduleListRow
                                    key={entry.id}
                                    chevron={canViewTickets}
                                    href={href}
                                    progress={progress}
                                    progressColor={progressColor}
                                    title={entry.name}
                                    trailing={trailing} />
                            );
                        }) }
                    </ScheduleList>
                </Stack> }
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
                        <SuspenseReveal
                            fallback={ <Skeleton variant="circular" width={40} height={40} /> }>
                            <EventFavouriteAction params={props.params} />
                        </SuspenseReveal>
                    }
                    description={
                        <SuspenseReveal fallback={ <Skeleton variant="text" width={112} /> }>
                            <EventDescription params={props.params} />
                        </SuspenseReveal>
                    }
                    icon={ <EventNoteOutlinedIcon /> }
                    title={
                        <SuspenseReveal fallback={ <Skeleton variant="text" width={160} /> }>
                            <EventTitle params={props.params} />
                        </SuspenseReveal>
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

export const instant = true;
export const prefetch = 'partial';
