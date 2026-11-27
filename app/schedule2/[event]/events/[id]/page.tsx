// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { cache } from 'react';
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
import { formatDate } from '@lib/Temporal';
import { getEventTicketSales } from '../../lib/data/ticketData';
import { getSchedulePath } from '../../lib/navigationTypes';
import { readCachedSetting } from '@lib/Settings';
import { requireScheduleAccess } from '../../lib/getScheduleAccess';
import db, { tActivities, tActivitiesAreas, tActivitiesLocations, tActivitiesTimeslots,
    tUsersEventsFavourites } from '@lib/database';

import { kActivityType } from '@lib/database/Types';

/**
 * Request-cached loader fetching program event details and scheduled timeslots for `activityParam`
 * in `festivalId`.
 */
const loadEventData = cache(async (festivalId: number | undefined, activityParam: string) => {
    const activityId = Number(activityParam);
    if (!festivalId || !Number.isInteger(activityId))
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
            .and(tActivities.activityId.equals(activityId))
        .select({
            end: tActivitiesTimeslots.timeslotEndTime,
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

    const locationNames = new Set(rows.map(row => row.locationName));
    const location = locationNames.size === 1
        ? rows[0].locationName
        : 'Multiple locations…';

    return {
        activityId,
        location,
        timeslots: rows,
        title: rows[0].title,
    };
});

/**
 * Streams the resolved program event title into the page `<Header>`.
 */
async function EventTitle(props: { params: Promise<{ event: string; id: string }> }) {
    const { event: eventSlug, id } = await props.params;
    const { event } = await requireScheduleAccess(eventSlug);
    const data = await loadEventData(event.integrations?.anPlanFestivalId, id);

    return data?.title ?? null;
}

/**
 * Streams the resolved event location summary into the page `<Header>` description.
 */
async function EventDescription(props: { params: Promise<{ event: string; id: string }> }) {
    const { event: eventSlug, id } = await props.params;
    const { event } = await requireScheduleAccess(eventSlug);
    const data = await loadEventData(event.integrations?.anPlanFestivalId, id);

    return data?.location ?? null;
}

/**
 * Streams the volunteer's favourite toggle button into the page `<Header>` actions.
 */
async function EventFavouriteAction(props: { params: Promise<{ event: string; id: string }> }) {
    const { event: eventSlug, id } = await props.params;
    const { event, user } = await requireScheduleAccess(eventSlug);
    const data = await loadEventData(event.integrations?.anPlanFestivalId, id);
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
 * Formats a ticket price given in `cents` as a compact EUR label (e.g. `€20` or `€12.50`).
 */
function formatPrice(cents: number): string {
    const euros = cents / 100;
    return Number.isInteger(euros) ? `€${euros}` : `€${euros.toFixed(2)}`;
}

/**
 * Authenticates the request behind `<Suspense>` and renders scheduled timeslots and ticket sales
 * for the event.
 */
async function EventContent(props: { params: Promise<{ event: string; id: string }> }) {
    const { event: eventSlug, id } = await props.params;
    const { access, currentTime, event } = await requireScheduleAccess(eventSlug);

    const [ data, showSales ] = await Promise.all([
        loadEventData(event.integrations?.anPlanFestivalId, id),
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
            const start = row.start.withTimeZone(event.timeZone);
            const end = row.end.withTimeZone(event.timeZone);
            const startMs = row.start.epochMilliseconds;
            const endMs = row.end.epochMilliseconds;
            const isPast = endMs <= nowMs;

            return {
                endMs,
                isActive: !isPast && startMs <= nowMs,
                isPast,
                locationId: row.locationId,
                locationName: row.locationName,
                startMs,
                time: `${formatDate(start, 'ddd, HH:mm')}–${formatDate(end, 'HH:mm')}`,
                timeslotId: row.timeslotId,
            };
        })
        .sort((lhs, rhs) =>
            Number(lhs.isPast) - Number(rhs.isPast) ||
            lhs.startMs - rhs.startMs ||
            lhs.endMs - rhs.endMs ||
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
                            progress={timeslot.isActive
                                ? Math.round(((nowMs - timeslot.startMs) /
                                    (timeslot.endMs - timeslot.startMs)) * 100)
                                : undefined}
                            state={timeslot.isPast
                                ? 'past'
                                : (timeslot.isActive ? 'active' : 'default')}
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
                                ? ` · ${formatPrice(entry.price)}`
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
